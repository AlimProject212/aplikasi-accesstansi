import { Request, Response } from 'express';
import { eq, and, desc, sql as dsql } from 'drizzle-orm';
import { db, posShifts, posTransactions, users, warehouses } from '../lib/prisma';

export const posShiftsController = {
  /** GET /api/pos/shifts/current — shift OPEN milik user yang login (kalau ada) */
  async getCurrent(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [shift] = await db.select().from(posShifts)
        .where(and(
          eq(posShifts.companyId, cId),
          eq(posShifts.cashierUserId, req.user!.id),
          eq(posShifts.status, 'OPEN'),
        ))
        .orderBy(desc(posShifts.openedAt)).limit(1);
      res.json(shift || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/pos/shifts — riwayat shift (untuk supervisor/admin) */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const list = await db.select({
        id: posShifts.id,
        cashierUserId: posShifts.cashierUserId,
        cashierName: users.name,
        warehouseId: posShifts.warehouseId,
        warehouseName: warehouses.name,
        openedAt: posShifts.openedAt,
        closedAt: posShifts.closedAt,
        openingCash: posShifts.openingCash,
        closingCash: posShifts.closingCash,
        status: posShifts.status,
      }).from(posShifts)
        .leftJoin(users, eq(posShifts.cashierUserId, users.id))
        .leftJoin(warehouses, eq(posShifts.warehouseId, warehouses.id))
        .where(eq(posShifts.companyId, cId))
        .orderBy(desc(posShifts.openedAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/pos/shifts — buka shift baru */
  async open(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { warehouseId, openingCash } = req.body as { warehouseId?: number; openingCash: number };

      const [existing] = await db.select({ id: posShifts.id }).from(posShifts)
        .where(and(eq(posShifts.companyId, cId), eq(posShifts.cashierUserId, req.user!.id), eq(posShifts.status, 'OPEN')))
        .limit(1);
      if (existing) { res.status(400).json({ error: 'Anda masih punya shift yang belum ditutup.' }); return; }

      const shiftId = crypto.randomUUID();
      await db.insert(posShifts).values({
        id: shiftId, companyId: cId, cashierUserId: req.user!.id,
        warehouseId: warehouseId ?? null, openedAt: new Date(),
        openingCash: openingCash || 0, status: 'OPEN',
      });

      const [shift] = await db.select().from(posShifts).where(eq(posShifts.id, shiftId)).limit(1);
      res.status(201).json(shift);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** POST /api/pos/shifts/:id/close — tutup shift + ringkasan rekonsiliasi kas */
  async close(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { closingCash } = req.body as { closingCash: number };
      const [shift] = await db.select().from(posShifts)
        .where(and(eq(posShifts.id, req.params.id), eq(posShifts.companyId, cId))).limit(1);
      if (!shift) { res.status(404).json({ error: 'Shift tidak ditemukan' }); return; }
      if (shift.status !== 'OPEN') { res.status(400).json({ error: 'Shift ini sudah ditutup' }); return; }
      if (shift.cashierUserId !== req.user!.id) { res.status(403).json({ error: 'Hanya kasir pemilik shift yang bisa menutup shift ini' }); return; }

      const [{ cashTotal }] = await db.select({ cashTotal: dsql<number>`COALESCE(SUM(${posTransactions.totalAmount}), 0)` })
        .from(posTransactions)
        .where(and(
          eq(posTransactions.shiftId, shift.id),
          eq(posTransactions.paymentMethod, 'CASH'),
          eq(posTransactions.status, 'COMPLETED'),
        ));

      const expectedCash = shift.openingCash + Number(cashTotal || 0);

      await db.update(posShifts)
        .set({ closedAt: new Date(), closingCash: closingCash || 0, status: 'CLOSED' })
        .where(eq(posShifts.id, shift.id));

      const [updated] = await db.select().from(posShifts).where(eq(posShifts.id, shift.id)).limit(1);
      res.json({ ...updated, expectedCash, difference: (closingCash || 0) - expectedCash });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
