import { Request, Response } from 'express';
import { eq, and, asc, desc, sql as dsql } from 'drizzle-orm';
import {
  db, stockAdjustments, stockAdjustmentLines, products, warehouses,
  inventorySettings, accounts, journalEntries, journalLines,
} from '../lib/prisma';
import { recordStockIn, recordStockOut } from '../services/inventory.service';

async function generateAdjustmentNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total }] = await db.select({ total: dsql<number>`COUNT(*)` }).from(stockAdjustments)
    .where(and(eq(stockAdjustments.companyId, companyId), dsql`YEAR(${stockAdjustments.date}) = ${year}`));
  const seq = (Number(total) || 0) + 1;
  return `ADJ-${year}-${String(seq).padStart(4, '0')}`;
}

async function fetchAdjustment(id: string, companyId: number) {
  const [header] = await db.select({
    id: stockAdjustments.id,
    companyId: stockAdjustments.companyId,
    adjustmentNumber: stockAdjustments.adjustmentNumber,
    warehouseId: stockAdjustments.warehouseId,
    warehouseName: warehouses.name,
    date: stockAdjustments.date,
    reason: stockAdjustments.reason,
    status: stockAdjustments.status,
    journalEntryId: stockAdjustments.journalEntryId,
    createdAt: stockAdjustments.createdAt,
  }).from(stockAdjustments)
    .leftJoin(warehouses, eq(stockAdjustments.warehouseId, warehouses.id))
    .where(and(eq(stockAdjustments.id, id), eq(stockAdjustments.companyId, companyId))).limit(1);
  if (!header) return null;

  const lines = await db.select({
    id: stockAdjustmentLines.id,
    productId: stockAdjustmentLines.productId,
    productName: products.name,
    productSku: products.sku,
    systemQty: stockAdjustmentLines.systemQty,
    actualQty: stockAdjustmentLines.actualQty,
    difference: stockAdjustmentLines.difference,
    unitCost: stockAdjustmentLines.unitCost,
  }).from(stockAdjustmentLines)
    .leftJoin(products, eq(stockAdjustmentLines.productId, products.id))
    .where(eq(stockAdjustmentLines.adjustmentId, id))
    .orderBy(asc(stockAdjustmentLines.sortOrder));

  return { ...header, lines };
}

export const stockAdjustmentsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.query;
      const list = await db.select({
        id: stockAdjustments.id,
        adjustmentNumber: stockAdjustments.adjustmentNumber,
        warehouseId: stockAdjustments.warehouseId,
        warehouseName: warehouses.name,
        date: stockAdjustments.date,
        reason: stockAdjustments.reason,
        status: stockAdjustments.status,
        createdAt: stockAdjustments.createdAt,
      }).from(stockAdjustments)
        .leftJoin(warehouses, eq(stockAdjustments.warehouseId, warehouses.id))
        .where(and(
          eq(stockAdjustments.companyId, cId),
          status ? eq(stockAdjustments.status, status as any) : undefined,
        ))
        .orderBy(desc(stockAdjustments.date));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const adj = await fetchAdjustment(req.params.id, req.user!.companyId);
      if (!adj) { res.status(404).json({ error: 'Penyesuaian stok tidak ditemukan' }); return; }
      res.json(adj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { warehouseId, date, reason, lines } = req.body as {
        warehouseId?: number; date: string; reason?: string;
        lines: { productId: string; actualQty: number }[];
      };
      if (!date) { res.status(400).json({ error: 'Tanggal wajib diisi' }); return; }
      if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ error: 'Minimal 1 baris produk' }); return; }

      const adjustmentId = crypto.randomUUID();
      const adjustmentNumber = await generateAdjustmentNumber(cId);

      await db.transaction(async (tx) => {
        await tx.insert(stockAdjustments).values({
          id: adjustmentId,
          companyId: cId,
          adjustmentNumber,
          warehouseId: warehouseId ?? null,
          date: new Date(date),
          reason: reason ?? null,
          status: 'DRAFT',
          createdById: req.user!.id,
        });

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const [product] = await tx.select().from(products)
            .where(and(eq(products.id, line.productId), eq(products.companyId, cId))).limit(1);
          if (!product) throw new Error(`Produk pada baris ${i + 1} tidak ditemukan`);

          await tx.insert(stockAdjustmentLines).values({
            id: crypto.randomUUID(),
            adjustmentId,
            productId: line.productId,
            systemQty: product.currentStock,
            actualQty: line.actualQty,
            difference: line.actualQty - product.currentStock,
            unitCost: product.avgCost,
            sortOrder: i,
          });
        }
      });

      const created = await fetchAdjustment(adjustmentId, cId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [adj] = await db.select({ status: stockAdjustments.status }).from(stockAdjustments)
        .where(and(eq(stockAdjustments.id, req.params.id), eq(stockAdjustments.companyId, cId))).limit(1);
      if (!adj) { res.status(404).json({ error: 'Penyesuaian stok tidak ditemukan' }); return; }
      if (adj.status !== 'DRAFT') { res.status(400).json({ error: 'Hanya draft yang bisa dihapus' }); return; }

      await db.delete(stockAdjustments)
        .where(and(eq(stockAdjustments.id, req.params.id), eq(stockAdjustments.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** POST /api/stock-adjustments/:id/post — proses selisih stok jadi mutasi stok + jurnal otomatis */
  async post(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [adj] = await db.select().from(stockAdjustments)
        .where(and(eq(stockAdjustments.id, req.params.id), eq(stockAdjustments.companyId, cId))).limit(1);
      if (!adj) { res.status(404).json({ error: 'Penyesuaian stok tidak ditemukan' }); return; }
      if (adj.status !== 'DRAFT') { res.status(400).json({ error: 'Penyesuaian stok ini sudah diposting' }); return; }

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      if (!settings?.inventoryAccountId || !settings?.stockAdjustmentAccountId) {
        res.status(400).json({ error: 'Atur akun Persediaan & akun Selisih Stok dulu di Pengaturan Persediaan.' });
        return;
      }

      const lines = await db.select().from(stockAdjustmentLines)
        .where(eq(stockAdjustmentLines.adjustmentId, adj.id)).orderBy(asc(stockAdjustmentLines.sortOrder));

      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        let totalIncreaseValue = 0;
        let totalDecreaseValue = 0;

        for (const line of lines) {
          const [product] = await tx.select().from(products)
            .where(and(eq(products.id, line.productId), eq(products.companyId, cId))).limit(1);
          if (!product) throw new Error('Produk pada salah satu baris tidak ditemukan');

          const liveDifference = line.actualQty - product.currentStock;
          if (liveDifference > 0) {
            const { unitCost } = await recordStockIn(tx, {
              companyId: cId, productId: line.productId, warehouseId: adj.warehouseId,
              qty: liveDifference, unitCost: product.avgCost, date: adj.date,
              refType: 'ADJUSTMENT', refId: adj.id,
              description: `Penyesuaian stok ${adj.adjustmentNumber} — selisih lebih`,
              createdById: req.user!.id,
            });
            totalIncreaseValue += liveDifference * unitCost;
          } else if (liveDifference < 0) {
            const qtyOut = Math.abs(liveDifference);
            const { unitCost } = await recordStockOut(tx, {
              companyId: cId, productId: line.productId, warehouseId: adj.warehouseId,
              qty: qtyOut, date: adj.date,
              refType: 'ADJUSTMENT', refId: adj.id,
              description: `Penyesuaian stok ${adj.adjustmentNumber} — selisih kurang`,
              createdById: req.user!.id,
            });
            totalDecreaseValue += qtyOut * unitCost;
          }
        }

        if (totalIncreaseValue > 0 || totalDecreaseValue > 0) {
          const [invAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.inventoryAccountId!)).limit(1);
          const [adjAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.stockAdjustmentAccountId!)).limit(1);

          const jLines: any[] = [];
          let sort = 0;
          if (totalIncreaseValue > 0) {
            jLines.push({ id: crypto.randomUUID(), accountId: invAcc.id, accountName: invAcc.name, debit: totalIncreaseValue, credit: 0, sortOrder: sort++ });
            jLines.push({ id: crypto.randomUUID(), accountId: adjAcc.id, accountName: adjAcc.name, debit: 0, credit: totalIncreaseValue, sortOrder: sort++ });
          }
          if (totalDecreaseValue > 0) {
            jLines.push({ id: crypto.randomUUID(), accountId: adjAcc.id, accountName: adjAcc.name, debit: totalDecreaseValue, credit: 0, sortOrder: sort++ });
            jLines.push({ id: crypto.randomUUID(), accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: totalDecreaseValue, sortOrder: sort++ });
          }

          journalEntryId = crypto.randomUUID();
          const totalAmount = totalIncreaseValue + totalDecreaseValue;
          await tx.insert(journalEntries).values({
            id: journalEntryId,
            companyId: cId,
            transactionDate: adj.date,
            referenceNumber: adj.adjustmentNumber,
            description: `Penyesuaian Stok ${adj.adjustmentNumber}${adj.reason ? ` — ${adj.reason}` : ''}`,
            totalAmount,
            status: 'POSTED',
            createdById: req.user!.id,
          });
          await tx.insert(journalLines).values(jLines.map((l) => ({ ...l, journalId: journalEntryId })));
        }

        await tx.update(stockAdjustments)
          .set({ status: 'POSTED', journalEntryId })
          .where(eq(stockAdjustments.id, adj.id));
      });

      const posted = await fetchAdjustment(adj.id, cId);
      res.json(posted);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
