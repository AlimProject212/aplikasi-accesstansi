import { Request, Response } from 'express';
import { eq, and, asc, desc, sql as dsql } from 'drizzle-orm';
import {
  db, salesInvoices, salesInvoiceLines, contacts, warehouses, products,
  inventorySettings, accounts, journalEntries, journalLines,
} from '../lib/prisma';
import { recordStockOut } from '../services/inventory.service';

async function generateInvoiceNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total }] = await db.select({ total: dsql<number>`COUNT(*)` }).from(salesInvoices)
    .where(and(eq(salesInvoices.companyId, companyId), dsql`YEAR(${salesInvoices.invoiceDate}) = ${year}`));
  const seq = (Number(total) || 0) + 1;
  return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

async function fetchInvoice(id: string, companyId: number) {
  const [header] = await db.select({
    id: salesInvoices.id,
    invoiceNumber: salesInvoices.invoiceNumber,
    customerId: salesInvoices.customerId,
    customerName: contacts.name,
    warehouseId: salesInvoices.warehouseId,
    warehouseName: warehouses.name,
    invoiceDate: salesInvoices.invoiceDate,
    dueDate: salesInvoices.dueDate,
    status: salesInvoices.status,
    subtotal: salesInvoices.subtotal,
    discount: salesInvoices.discount,
    tax: salesInvoices.tax,
    totalAmount: salesInvoices.totalAmount,
    paidAmount: salesInvoices.paidAmount,
    journalEntryId: salesInvoices.journalEntryId,
    notes: salesInvoices.notes,
    createdAt: salesInvoices.createdAt,
  }).from(salesInvoices)
    .leftJoin(contacts, eq(salesInvoices.customerId, contacts.id))
    .leftJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
    .where(and(eq(salesInvoices.id, id), eq(salesInvoices.companyId, companyId))).limit(1);
  if (!header) return null;

  const lines = await db.select({
    id: salesInvoiceLines.id,
    productId: salesInvoiceLines.productId,
    productName: products.name,
    productSku: products.sku,
    qty: salesInvoiceLines.qty,
    unitPrice: salesInvoiceLines.unitPrice,
    unitCost: salesInvoiceLines.unitCost,
    lineTotal: salesInvoiceLines.lineTotal,
  }).from(salesInvoiceLines)
    .leftJoin(products, eq(salesInvoiceLines.productId, products.id))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(asc(salesInvoiceLines.sortOrder));

  return { ...header, lines };
}

export const salesInvoicesController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.query;
      const list = await db.select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerId: salesInvoices.customerId,
        customerName: contacts.name,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        status: salesInvoices.status,
        totalAmount: salesInvoices.totalAmount,
        paidAmount: salesInvoices.paidAmount,
      }).from(salesInvoices)
        .leftJoin(contacts, eq(salesInvoices.customerId, contacts.id))
        .where(and(
          eq(salesInvoices.companyId, cId),
          status ? eq(salesInvoices.status, status as any) : undefined,
        ))
        .orderBy(desc(salesInvoices.invoiceDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const invoice = await fetchInvoice(req.params.id, req.user!.companyId);
      if (!invoice) { res.status(404).json({ error: 'Faktur tidak ditemukan' }); return; }
      res.json(invoice);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { customerId, warehouseId, invoiceDate, dueDate, discount, tax, notes, lines } = req.body as {
        customerId: string; warehouseId?: number; invoiceDate: string; dueDate?: string;
        discount?: number; tax?: number; notes?: string;
        lines: { productId: string; qty: number; unitPrice: number }[];
      };
      if (!customerId || !invoiceDate) { res.status(400).json({ error: 'Customer dan tanggal faktur wajib diisi' }); return; }
      if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ error: 'Minimal 1 baris produk' }); return; }

      const [customer] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.id, customerId), eq(contacts.companyId, cId))).limit(1);
      if (!customer) { res.status(400).json({ error: 'Customer tidak ditemukan' }); return; }

      const invoiceId = crypto.randomUUID();
      const invoiceNumber = await generateInvoiceNumber(cId);
      const subtotal = lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0);
      const disc = discount || 0;
      const taxAmt = tax || 0;
      const totalAmount = subtotal - disc + taxAmt;

      await db.transaction(async (tx) => {
        await tx.insert(salesInvoices).values({
          id: invoiceId, companyId: cId, invoiceNumber, customerId,
          warehouseId: warehouseId ?? null, invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : null, status: 'DRAFT',
          subtotal, discount: disc, tax: taxAmt, totalAmount, paidAmount: 0,
          notes: notes ?? null, createdById: req.user!.id,
        });

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const [product] = await tx.select({ avgCost: products.avgCost }).from(products)
            .where(and(eq(products.id, l.productId), eq(products.companyId, cId))).limit(1);
          if (!product) throw new Error(`Produk pada baris ${i + 1} tidak ditemukan`);
          await tx.insert(salesInvoiceLines).values({
            id: crypto.randomUUID(), invoiceId, productId: l.productId,
            qty: l.qty, unitPrice: l.unitPrice, unitCost: product.avgCost,
            lineTotal: l.qty * l.unitPrice, sortOrder: i,
          });
        }
      });

      const created = await fetchInvoice(invoiceId, cId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [invoice] = await db.select({ status: salesInvoices.status }).from(salesInvoices)
        .where(and(eq(salesInvoices.id, req.params.id), eq(salesInvoices.companyId, cId))).limit(1);
      if (!invoice) { res.status(404).json({ error: 'Faktur tidak ditemukan' }); return; }
      if (invoice.status !== 'DRAFT') { res.status(400).json({ error: 'Hanya draft yang bisa dihapus' }); return; }

      await db.delete(salesInvoices)
        .where(and(eq(salesInvoices.id, req.params.id), eq(salesInvoices.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** POST /api/sales-invoices/:id/post — stok keluar otomatis + jurnal AR/Pendapatan/HPP sekaligus */
  async post(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [invoice] = await db.select().from(salesInvoices)
        .where(and(eq(salesInvoices.id, req.params.id), eq(salesInvoices.companyId, cId))).limit(1);
      if (!invoice) { res.status(404).json({ error: 'Faktur tidak ditemukan' }); return; }
      if (invoice.status !== 'DRAFT') { res.status(400).json({ error: 'Faktur ini sudah diposting' }); return; }

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      if (!settings?.inventoryAccountId || !settings?.receivableAccountId || !settings?.salesRevenueAccountId || !settings?.cogsAccountId) {
        res.status(400).json({ error: 'Atur akun Persediaan, Piutang Usaha, Pendapatan Penjualan & HPP dulu di Pengaturan Persediaan.' });
        return;
      }
      if (invoice.tax > 0 && !settings.salesTaxAccountId) {
        res.status(400).json({ error: 'Faktur ini ada pajak — atur dulu akun PPN Keluaran di Pengaturan Persediaan.' });
        return;
      }

      const lines = await db.select().from(salesInvoiceLines)
        .where(eq(salesInvoiceLines.invoiceId, invoice.id)).orderBy(asc(salesInvoiceLines.sortOrder));

      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        let totalCogs = 0;
        for (const line of lines) {
          const { unitCost } = await recordStockOut(tx, {
            companyId: cId, productId: line.productId, warehouseId: invoice.warehouseId,
            qty: line.qty, date: invoice.invoiceDate,
            refType: 'SALE', refId: invoice.id,
            description: `Faktur Penjualan ${invoice.invoiceNumber}`,
            createdById: req.user!.id,
          });
          totalCogs += line.qty * unitCost;
          await tx.update(salesInvoiceLines).set({ unitCost }).where(eq(salesInvoiceLines.id, line.id));
        }

        const [arAcc]  = await tx.select().from(accounts).where(eq(accounts.id, settings.receivableAccountId!)).limit(1);
        const [revAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.salesRevenueAccountId!)).limit(1);
        const [cogsAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.cogsAccountId!)).limit(1);
        const [invAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.inventoryAccountId!)).limit(1);

        const jLines: any[] = [
          { id: crypto.randomUUID(), accountId: arAcc.id, accountName: arAcc.name, debit: invoice.totalAmount, credit: 0, contactId: invoice.customerId, sortOrder: 0 },
          { id: crypto.randomUUID(), accountId: revAcc.id, accountName: revAcc.name, debit: 0, credit: invoice.subtotal - invoice.discount, contactId: invoice.customerId, sortOrder: 1 },
        ];
        let sort = 2;
        if (invoice.tax > 0) {
          const [taxAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.salesTaxAccountId!)).limit(1);
          jLines.push({ id: crypto.randomUUID(), accountId: taxAcc.id, accountName: taxAcc.name, debit: 0, credit: invoice.tax, contactId: invoice.customerId, sortOrder: sort++ });
        }
        jLines.push({ id: crypto.randomUUID(), accountId: cogsAcc.id, accountName: cogsAcc.name, debit: totalCogs, credit: 0, sortOrder: sort++ });
        jLines.push({ id: crypto.randomUUID(), accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: totalCogs, sortOrder: sort++ });

        journalEntryId = crypto.randomUUID();
        await tx.insert(journalEntries).values({
          id: journalEntryId,
          companyId: cId,
          transactionDate: invoice.invoiceDate,
          referenceNumber: invoice.invoiceNumber,
          description: `Faktur Penjualan ${invoice.invoiceNumber}`,
          totalAmount: invoice.totalAmount + totalCogs,
          status: 'POSTED',
          createdById: req.user!.id,
        });
        await tx.insert(journalLines).values(jLines.map((l) => ({ ...l, journalId: journalEntryId })));

        await tx.update(salesInvoices)
          .set({ status: 'POSTED', journalEntryId })
          .where(eq(salesInvoices.id, invoice.id));
      });

      const posted = await fetchInvoice(invoice.id, cId);
      res.json(posted);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
