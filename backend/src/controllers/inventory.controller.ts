import { Request, Response } from 'express';
import { eq, and, gte, lte, asc, desc, sql as dsql } from 'drizzle-orm';
import {
  db, stockLedger, products, productCategories,
  salesInvoiceLines, salesInvoices, posTransactionLines, posTransactions,
} from '../lib/prisma';

export const inventoryController = {
  /** GET /api/inventory/stock-card/:productId?from=&to= — Kartu Stok per produk */
  async getStockCard(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { productId } = req.params;
      const { from, to } = req.query;

      const [product] = await db.select().from(products)
        .where(and(eq(products.id, productId), eq(products.companyId, cId))).limit(1);
      if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }

      const entries = await db.select().from(stockLedger)
        .where(and(
          eq(stockLedger.productId, productId),
          eq(stockLedger.companyId, cId),
          from ? gte(stockLedger.date, new Date(from as string)) : undefined,
          to ? lte(stockLedger.date, new Date(`${to as string}T23:59:59.999Z`)) : undefined,
        ))
        .orderBy(asc(stockLedger.date), asc(stockLedger.createdAt));

      res.json({ product, entries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/inventory/valuation — Laporan Nilai Persediaan */
  async getValuation(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const rows = await db.select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        categoryName: productCategories.name,
        currentStock: products.currentStock,
        avgCost: products.avgCost,
      }).from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(eq(products.companyId, cId), eq(products.isActive, true)))
        .orderBy(desc(products.currentStock));

      const items = rows.map(r => ({ ...r, value: r.currentStock * r.avgCost }));
      const totalValue = items.reduce((s, r) => s + r.value, 0);

      res.json({ items, totalValue });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/inventory/low-stock — produk dengan stok di/bawah batas minimum */
  async getLowStock(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const rows = await db.select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        categoryName: productCategories.name,
        currentStock: products.currentStock,
        minStock: products.minStock,
        avgCost: products.avgCost,
      }).from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(
          eq(products.companyId, cId),
          eq(products.isActive, true),
          dsql`${products.currentStock} <= ${products.minStock}`,
        ))
        .orderBy(asc(products.currentStock));

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/inventory/gross-margin?from=&to= — Laba kotor per produk (gabungan Faktur B2B + POS) */
  async getGrossMargin(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : undefined;
      const toDate = to ? new Date(`${to as string}T23:59:59.999Z`) : undefined;

      const invoiceLines = await db.select({
        productId: salesInvoiceLines.productId,
        qty: salesInvoiceLines.qty,
        lineTotal: salesInvoiceLines.lineTotal,
        cogs: dsql<number>`${salesInvoiceLines.qty} * ${salesInvoiceLines.unitCost}`,
      }).from(salesInvoiceLines)
        .innerJoin(salesInvoices, eq(salesInvoiceLines.invoiceId, salesInvoices.id))
        .where(and(
          eq(salesInvoices.companyId, cId),
          eq(salesInvoices.status, 'POSTED'),
          fromDate ? gte(salesInvoices.invoiceDate, fromDate) : undefined,
          toDate ? lte(salesInvoices.invoiceDate, toDate) : undefined,
        ));

      const posLines = await db.select({
        productId: posTransactionLines.productId,
        qty: posTransactionLines.qty,
        lineTotal: posTransactionLines.lineTotal,
        cogs: dsql<number>`${posTransactionLines.qty} * ${posTransactionLines.unitCost}`,
      }).from(posTransactionLines)
        .innerJoin(posTransactions, eq(posTransactionLines.transactionId, posTransactions.id))
        .where(and(
          eq(posTransactions.companyId, cId),
          eq(posTransactions.status, 'COMPLETED'),
          fromDate ? gte(posTransactions.transactionDate, fromDate) : undefined,
          toDate ? lte(posTransactions.transactionDate, toDate) : undefined,
        ));

      const byProduct = new Map<string, { qtySold: number; revenue: number; cogs: number }>();
      for (const l of [...invoiceLines, ...posLines]) {
        const cur = byProduct.get(l.productId) || { qtySold: 0, revenue: 0, cogs: 0 };
        cur.qtySold += l.qty;
        cur.revenue += l.lineTotal;
        cur.cogs += Number(l.cogs) || 0;
        byProduct.set(l.productId, cur);
      }

      if (byProduct.size === 0) { res.json({ items: [], totals: { revenue: 0, cogs: 0, grossMargin: 0 } }); return; }

      const productRows = await db.select({
        id: products.id, sku: products.sku, name: products.name,
      }).from(products).where(eq(products.companyId, cId));
      const productMap = new Map(productRows.map(p => [p.id, p]));

      const items = Array.from(byProduct.entries()).map(([productId, agg]) => {
        const grossMargin = agg.revenue - agg.cogs;
        return {
          productId,
          sku: productMap.get(productId)?.sku || '-',
          name: productMap.get(productId)?.name || '(produk dihapus)',
          qtySold: agg.qtySold,
          revenue: agg.revenue,
          cogs: agg.cogs,
          grossMargin,
          marginPercent: agg.revenue > 0 ? (grossMargin / agg.revenue) * 100 : 0,
        };
      }).sort((a, b) => b.grossMargin - a.grossMargin);

      const totals = items.reduce((s, i) => ({
        revenue: s.revenue + i.revenue, cogs: s.cogs + i.cogs, grossMargin: s.grossMargin + i.grossMargin,
      }), { revenue: 0, cogs: 0, grossMargin: 0 });

      res.json({ items, totals });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
