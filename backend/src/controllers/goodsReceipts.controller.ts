import { Request, Response } from 'express';
import { eq, and, asc, desc, sql as dsql } from 'drizzle-orm';
import {
  db, goodsReceipts, goodsReceiptLines, purchaseOrders, purchaseOrderLines,
  contacts, warehouses, products, inventorySettings, accounts, journalEntries, journalLines,
} from '../lib/prisma';
import { recordStockIn } from '../services/inventory.service';

async function generateReceiptNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total }] = await db.select({ total: dsql<number>`COUNT(*)` }).from(goodsReceipts)
    .where(and(eq(goodsReceipts.companyId, companyId), dsql`YEAR(${goodsReceipts.receiptDate}) = ${year}`));
  const seq = (Number(total) || 0) + 1;
  return `GR-${year}-${String(seq).padStart(4, '0')}`;
}

async function fetchReceipt(id: string, companyId: number) {
  const [header] = await db.select({
    id: goodsReceipts.id,
    receiptNumber: goodsReceipts.receiptNumber,
    poId: goodsReceipts.poId,
    vendorId: goodsReceipts.vendorId,
    vendorName: contacts.name,
    warehouseId: goodsReceipts.warehouseId,
    warehouseName: warehouses.name,
    receiptDate: goodsReceipts.receiptDate,
    status: goodsReceipts.status,
    totalAmount: goodsReceipts.totalAmount,
    paidAmount: goodsReceipts.paidAmount,
    journalEntryId: goodsReceipts.journalEntryId,
    notes: goodsReceipts.notes,
    createdAt: goodsReceipts.createdAt,
  }).from(goodsReceipts)
    .leftJoin(contacts, eq(goodsReceipts.vendorId, contacts.id))
    .leftJoin(warehouses, eq(goodsReceipts.warehouseId, warehouses.id))
    .where(and(eq(goodsReceipts.id, id), eq(goodsReceipts.companyId, companyId))).limit(1);
  if (!header) return null;

  const lines = await db.select({
    id: goodsReceiptLines.id,
    productId: goodsReceiptLines.productId,
    productName: products.name,
    productSku: products.sku,
    qty: goodsReceiptLines.qty,
    unitCost: goodsReceiptLines.unitCost,
  }).from(goodsReceiptLines)
    .leftJoin(products, eq(goodsReceiptLines.productId, products.id))
    .where(eq(goodsReceiptLines.receiptId, id))
    .orderBy(asc(goodsReceiptLines.sortOrder));

  return { ...header, lines };
}

export const goodsReceiptsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.query;
      const list = await db.select({
        id: goodsReceipts.id,
        receiptNumber: goodsReceipts.receiptNumber,
        vendorId: goodsReceipts.vendorId,
        vendorName: contacts.name,
        receiptDate: goodsReceipts.receiptDate,
        status: goodsReceipts.status,
        totalAmount: goodsReceipts.totalAmount,
        paidAmount: goodsReceipts.paidAmount,
      }).from(goodsReceipts)
        .leftJoin(contacts, eq(goodsReceipts.vendorId, contacts.id))
        .where(and(
          eq(goodsReceipts.companyId, cId),
          status ? eq(goodsReceipts.status, status as any) : undefined,
        ))
        .orderBy(desc(goodsReceipts.receiptDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const receipt = await fetchReceipt(req.params.id, req.user!.companyId);
      if (!receipt) { res.status(404).json({ error: 'Penerimaan barang tidak ditemukan' }); return; }
      res.json(receipt);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { poId, vendorId, warehouseId, receiptDate, notes, lines } = req.body as {
        poId?: string; vendorId: string; warehouseId?: number; receiptDate: string; notes?: string;
        lines: { productId: string; qty: number; unitCost: number }[];
      };
      if (!vendorId || !receiptDate) { res.status(400).json({ error: 'Vendor dan tanggal terima wajib diisi' }); return; }
      if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ error: 'Minimal 1 baris produk' }); return; }

      const [vendor] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.id, vendorId), eq(contacts.companyId, cId))).limit(1);
      if (!vendor) { res.status(400).json({ error: 'Vendor tidak ditemukan' }); return; }

      if (poId) {
        const [po] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.companyId, cId))).limit(1);
        if (!po) { res.status(400).json({ error: 'Purchase Order tidak ditemukan' }); return; }
      }

      const receiptId = crypto.randomUUID();
      const receiptNumber = await generateReceiptNumber(cId);
      const totalAmount = lines.reduce((s, l) => s + (l.qty * l.unitCost), 0);

      await db.transaction(async (tx) => {
        await tx.insert(goodsReceipts).values({
          id: receiptId, companyId: cId, receiptNumber, poId: poId ?? null, vendorId,
          warehouseId: warehouseId ?? null, receiptDate: new Date(receiptDate),
          status: 'DRAFT', totalAmount, paidAmount: 0, notes: notes ?? null, createdById: req.user!.id,
        });
        await tx.insert(goodsReceiptLines).values(
          lines.map((l, i) => ({
            id: crypto.randomUUID(), receiptId, productId: l.productId,
            qty: l.qty, unitCost: l.unitCost, sortOrder: i,
          })),
        );
      });

      const created = await fetchReceipt(receiptId, cId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [receipt] = await db.select({ status: goodsReceipts.status }).from(goodsReceipts)
        .where(and(eq(goodsReceipts.id, req.params.id), eq(goodsReceipts.companyId, cId))).limit(1);
      if (!receipt) { res.status(404).json({ error: 'Penerimaan barang tidak ditemukan' }); return; }
      if (receipt.status !== 'DRAFT') { res.status(400).json({ error: 'Hanya draft yang bisa dihapus' }); return; }

      await db.delete(goodsReceipts)
        .where(and(eq(goodsReceipts.id, req.params.id), eq(goodsReceipts.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** POST /api/goods-receipts/:id/post — stok masuk otomatis + jurnal Dr Persediaan / Cr Hutang Usaha */
  async post(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [receipt] = await db.select().from(goodsReceipts)
        .where(and(eq(goodsReceipts.id, req.params.id), eq(goodsReceipts.companyId, cId))).limit(1);
      if (!receipt) { res.status(404).json({ error: 'Penerimaan barang tidak ditemukan' }); return; }
      if (receipt.status !== 'DRAFT') { res.status(400).json({ error: 'Penerimaan barang ini sudah diposting' }); return; }

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      if (!settings?.inventoryAccountId || !settings?.payableAccountId) {
        res.status(400).json({ error: 'Atur akun Persediaan & akun Hutang Usaha dulu di Pengaturan Persediaan.' });
        return;
      }

      const lines = await db.select().from(goodsReceiptLines)
        .where(eq(goodsReceiptLines.receiptId, receipt.id)).orderBy(asc(goodsReceiptLines.sortOrder));

      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        for (const line of lines) {
          await recordStockIn(tx, {
            companyId: cId, productId: line.productId, warehouseId: receipt.warehouseId,
            qty: line.qty, unitCost: line.unitCost, date: receipt.receiptDate,
            refType: 'PURCHASE', refId: receipt.id,
            description: `Penerimaan barang ${receipt.receiptNumber}`,
            createdById: req.user!.id,
          });

          if (receipt.poId) {
            await tx.update(purchaseOrderLines)
              .set({ qtyReceived: dsql`${purchaseOrderLines.qtyReceived} + ${line.qty}` })
              .where(and(eq(purchaseOrderLines.poId, receipt.poId), eq(purchaseOrderLines.productId, line.productId)));
          }
        }

        if (receipt.poId) {
          const poLines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, receipt.poId));
          const allReceived = poLines.every(l => l.qtyReceived >= l.qtyOrdered);
          const anyReceived = poLines.some(l => l.qtyReceived > 0);
          await tx.update(purchaseOrders)
            .set({ status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : 'ORDERED' })
            .where(eq(purchaseOrders.id, receipt.poId));
        }

        const [invAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.inventoryAccountId!)).limit(1);
        const [payAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.payableAccountId!)).limit(1);

        journalEntryId = crypto.randomUUID();
        await tx.insert(journalEntries).values({
          id: journalEntryId,
          companyId: cId,
          transactionDate: receipt.receiptDate,
          referenceNumber: receipt.receiptNumber,
          description: `Penerimaan Barang ${receipt.receiptNumber}`,
          totalAmount: receipt.totalAmount,
          status: 'POSTED',
          createdById: req.user!.id,
        });
        await tx.insert(journalLines).values([
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: invAcc.id, accountName: invAcc.name, debit: receipt.totalAmount, credit: 0, contactId: receipt.vendorId, sortOrder: 0 },
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: payAcc.id, accountName: payAcc.name, debit: 0, credit: receipt.totalAmount, contactId: receipt.vendorId, sortOrder: 1 },
        ]);

        await tx.update(goodsReceipts)
          .set({ status: 'POSTED', journalEntryId })
          .where(eq(goodsReceipts.id, receipt.id));
      });

      const posted = await fetchReceipt(receipt.id, cId);
      res.json(posted);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
