import { Request, Response } from 'express';
import { eq, and, asc, count } from 'drizzle-orm';
import { db, warehouses, products } from '../lib/prisma';

export const warehousesController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      let list = await db.select().from(warehouses)
        .where(eq(warehouses.companyId, cId))
        .orderBy(asc(warehouses.name));

      if (list.length === 0) {
        await db.insert(warehouses).values({ companyId: cId, name: 'Gudang Utama', isDefault: true });
        list = await db.select().from(warehouses)
          .where(eq(warehouses.companyId, cId))
          .orderBy(asc(warehouses.name));
      }

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, address } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: 'Nama gudang wajib diisi.' }); return; }

      const [existing] = await db.select().from(warehouses)
        .where(and(eq(warehouses.companyId, cId), eq(warehouses.name, name.trim()))).limit(1);
      if (existing) { res.status(400).json({ error: 'Gudang dengan nama ini sudah ada.' }); return; }

      const result = await db.insert(warehouses).values({ companyId: cId, name: name.trim(), address: address?.trim() || null });
      const insertId = (result as any).insertId;
      const [created] = await db.select().from(warehouses)
        .where(and(eq(warehouses.id, insertId), eq(warehouses.companyId, cId))).limit(1);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { name, address, isActive } = req.body;

      const [wh] = await db.select().from(warehouses)
        .where(and(eq(warehouses.id, id), eq(warehouses.companyId, cId))).limit(1);
      if (!wh) { res.status(404).json({ error: 'Gudang tidak ditemukan.' }); return; }

      const updateData: Record<string, any> = {};
      if (name !== undefined) {
        if (!name.trim()) { res.status(400).json({ error: 'Nama gudang wajib diisi.' }); return; }
        updateData.name = name.trim();
      }
      if (address !== undefined) updateData.address = address?.trim() || null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      if (Object.keys(updateData).length > 0) {
        await db.update(warehouses).set(updateData)
          .where(and(eq(warehouses.id, id), eq(warehouses.companyId, cId)));
      }
      const [updated] = await db.select().from(warehouses)
        .where(and(eq(warehouses.id, id), eq(warehouses.companyId, cId))).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);

      const [wh] = await db.select().from(warehouses)
        .where(and(eq(warehouses.id, id), eq(warehouses.companyId, cId))).limit(1);
      if (!wh) { res.status(404).json({ error: 'Gudang tidak ditemukan.' }); return; }
      if (wh.isDefault) { res.status(400).json({ error: 'Gudang default tidak dapat dihapus.' }); return; }

      const [{ total }] = await db.select({ total: count() }).from(warehouses)
        .where(eq(warehouses.companyId, cId));
      if (total <= 1) { res.status(400).json({ error: 'Minimal harus ada 1 gudang.' }); return; }

      await db.delete(warehouses)
        .where(and(eq(warehouses.id, id), eq(warehouses.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
