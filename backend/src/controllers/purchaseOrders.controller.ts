import { Request, Response } from 'express';
import { eq, and, asc, desc, sql as dsql } from 'drizzle-orm';
import { db, purchaseOrders, purchaseOrderLines, contacts, products } from '../lib/prisma';

async function generatePoNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total }] = await db.select({ total: dsql<number>`COUNT(*)` }).from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, companyId), dsql`YEAR(${purchaseOrders.orderDate}) = ${year}`));
  const seq = (Number(total) || 0) + 1;
  return `PO-${year}-${String(seq).padStart(4, '0')}`;
}

async function fetchPO(id: string, companyId: number) {
  const [header] = await db.select({
    id: purchaseOrders.id,
    poNumber: purchaseOrders.poNumber,
    vendorId: purchaseOrders.vendorId,
    vendorName: contacts.name,
    orderDate: purchaseOrders.orderDate,
    expectedDate: purchaseOrders.expectedDate,
    status: purchaseOrders.status,
    notes: purchaseOrders.notes,
    createdAt: purchaseOrders.createdAt,
  }).from(purchaseOrders)
    .leftJoin(contacts, eq(purchaseOrders.vendorId, contacts.id))
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, companyId))).limit(1);
  if (!header) return null;

  const lines = await db.select({
    id: purchaseOrderLines.id,
    productId: purchaseOrderLines.productId,
    productName: products.name,
    productSku: products.sku,
    qtyOrdered: purchaseOrderLines.qtyOrdered,
    qtyReceived: purchaseOrderLines.qtyReceived,
    unitPrice: purchaseOrderLines.unitPrice,
  }).from(purchaseOrderLines)
    .leftJoin(products, eq(purchaseOrderLines.productId, products.id))
    .where(eq(purchaseOrderLines.poId, id))
    .orderBy(asc(purchaseOrderLines.sortOrder));

  return { ...header, lines };
}

export const purchaseOrdersController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.query;
      const list = await db.select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        vendorId: purchaseOrders.vendorId,
        vendorName: contacts.name,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        createdAt: purchaseOrders.createdAt,
      }).from(purchaseOrders)
        .leftJoin(contacts, eq(purchaseOrders.vendorId, contacts.id))
        .where(and(
          eq(purchaseOrders.companyId, cId),
          status ? eq(purchaseOrders.status, status as any) : undefined,
        ))
        .orderBy(desc(purchaseOrders.orderDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const po = await fetchPO(req.params.id, req.user!.companyId);
      if (!po) { res.status(404).json({ error: 'Purchase Order tidak ditemukan' }); return; }
      res.json(po);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { vendorId, orderDate, expectedDate, notes, lines } = req.body as {
        vendorId: string; orderDate: string; expectedDate?: string; notes?: string;
        lines: { productId: string; qtyOrdered: number; unitPrice: number }[];
      };
      if (!vendorId || !orderDate) { res.status(400).json({ error: 'Vendor dan tanggal pesan wajib diisi' }); return; }
      if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ error: 'Minimal 1 baris produk' }); return; }

      const [vendor] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.id, vendorId), eq(contacts.companyId, cId))).limit(1);
      if (!vendor) { res.status(400).json({ error: 'Vendor tidak ditemukan' }); return; }

      const poId = crypto.randomUUID();
      const poNumber = await generatePoNumber(cId);

      await db.transaction(async (tx) => {
        await tx.insert(purchaseOrders).values({
          id: poId, companyId: cId, poNumber, vendorId,
          orderDate: new Date(orderDate),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          status: 'DRAFT', notes: notes ?? null, createdById: req.user!.id,
        });
        await tx.insert(purchaseOrderLines).values(
          lines.map((l, i) => ({
            id: crypto.randomUUID(), poId, productId: l.productId,
            qtyOrdered: l.qtyOrdered, qtyReceived: 0, unitPrice: l.unitPrice || 0, sortOrder: i,
          })),
        );
      });

      const created = await fetchPO(poId, cId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [existing] = await db.select().from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Purchase Order tidak ditemukan' }); return; }
      if (existing.status !== 'DRAFT') { res.status(400).json({ error: 'Hanya PO berstatus DRAFT yang bisa diedit' }); return; }

      const { vendorId, orderDate, expectedDate, notes, lines } = req.body as {
        vendorId?: string; orderDate?: string; expectedDate?: string; notes?: string;
        lines?: { productId: string; qtyOrdered: number; unitPrice: number }[];
      };

      if (vendorId !== undefined) {
        const [vendor] = await db.select({ id: contacts.id }).from(contacts)
          .where(and(eq(contacts.id, vendorId), eq(contacts.companyId, cId))).limit(1);
        if (!vendor) { res.status(400).json({ error: 'Vendor tidak ditemukan' }); return; }
      }

      await db.transaction(async (tx) => {
        const updateData: Record<string, any> = {};
        if (vendorId !== undefined) updateData.vendorId = vendorId;
        if (orderDate !== undefined) updateData.orderDate = new Date(orderDate);
        if (expectedDate !== undefined) updateData.expectedDate = expectedDate ? new Date(expectedDate) : null;
        if (notes !== undefined) updateData.notes = notes;
        if (Object.keys(updateData).length > 0) {
          await tx.update(purchaseOrders).set(updateData)
            .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId)));
        }
        if (lines) {
          await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.poId, req.params.id));
          await tx.insert(purchaseOrderLines).values(
            lines.map((l, i) => ({
              id: crypto.randomUUID(), poId: req.params.id, productId: l.productId,
              qtyOrdered: l.qtyOrdered, qtyReceived: 0, unitPrice: l.unitPrice || 0, sortOrder: i,
            })),
          );
        }
      });

      const updated = await fetchPO(req.params.id, cId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** PUT /api/purchase-orders/:id/status — body: { status: 'ORDERED' | 'CANCELLED' } */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.body as { status: string };
      const [po] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId))).limit(1);
      if (!po) { res.status(404).json({ error: 'Purchase Order tidak ditemukan' }); return; }

      const allowed: Record<string, string[]> = {
        DRAFT: ['ORDERED', 'CANCELLED'],
        ORDERED: ['CANCELLED'],
        PARTIAL: ['CANCELLED'],
        RECEIVED: [],
        CANCELLED: [],
      };
      if (!allowed[po.status]?.includes(status)) {
        res.status(400).json({ error: `Tidak bisa ubah status dari ${po.status} ke ${status}` });
        return;
      }

      await db.update(purchaseOrders).set({ status: status as any })
        .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId)));

      const updated = await fetchPO(req.params.id, cId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [po] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId))).limit(1);
      if (!po) { res.status(404).json({ error: 'Purchase Order tidak ditemukan' }); return; }
      if (po.status !== 'DRAFT') { res.status(400).json({ error: 'Hanya PO berstatus DRAFT yang bisa dihapus' }); return; }

      await db.delete(purchaseOrders)
        .where(and(eq(purchaseOrders.id, req.params.id), eq(purchaseOrders.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
