import { Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, salesPayments, salesInvoices, contacts, accounts, inventorySettings, journalEntries, journalLines } from '../lib/prisma';

export const salesPaymentsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { invoiceId } = req.query;
      const list = await db.select({
        id: salesPayments.id,
        invoiceId: salesPayments.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerName: contacts.name,
        paymentDate: salesPayments.paymentDate,
        amount: salesPayments.amount,
        accountId: salesPayments.accountId,
        accountName: accounts.name,
        notes: salesPayments.notes,
        createdAt: salesPayments.createdAt,
      }).from(salesPayments)
        .leftJoin(salesInvoices, eq(salesPayments.invoiceId, salesInvoices.id))
        .leftJoin(contacts, eq(salesInvoices.customerId, contacts.id))
        .leftJoin(accounts, eq(salesPayments.accountId, accounts.id))
        .where(and(
          eq(salesPayments.companyId, cId),
          invoiceId ? eq(salesPayments.invoiceId, invoiceId as string) : undefined,
        ))
        .orderBy(desc(salesPayments.paymentDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { invoiceId, paymentDate, amount, accountId, notes } = req.body as {
        invoiceId: string; paymentDate: string; amount: number; accountId: string; notes?: string;
      };
      if (!invoiceId || !paymentDate || !amount || amount <= 0 || !accountId) {
        res.status(400).json({ error: 'invoiceId, paymentDate, amount, dan accountId wajib diisi' });
        return;
      }

      const [invoice] = await db.select().from(salesInvoices)
        .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.companyId, cId))).limit(1);
      if (!invoice) { res.status(404).json({ error: 'Faktur tidak ditemukan' }); return; }
      if (invoice.status !== 'POSTED') { res.status(400).json({ error: 'Hanya faktur yang sudah diposting bisa dibayar' }); return; }

      const remaining = invoice.totalAmount - invoice.paidAmount;
      if (amount > remaining + 0.01) {
        res.status(400).json({ error: `Jumlah bayar (${amount}) melebihi sisa piutang (${remaining})` });
        return;
      }

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      if (!settings?.receivableAccountId) {
        res.status(400).json({ error: 'Atur akun Piutang Usaha dulu di Pengaturan Persediaan.' });
        return;
      }

      const paymentId = crypto.randomUUID();
      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        const [arAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.receivableAccountId!)).limit(1);
        const [cashAcc] = await tx.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.companyId, cId))).limit(1);
        if (!cashAcc) throw new Error('Akun kas/bank tidak ditemukan');

        journalEntryId = crypto.randomUUID();
        await tx.insert(journalEntries).values({
          id: journalEntryId,
          companyId: cId,
          transactionDate: new Date(paymentDate),
          referenceNumber: `PAY-${invoice.invoiceNumber}`,
          description: `Pelunasan Piutang — ${invoice.invoiceNumber}`,
          totalAmount: amount,
          status: 'POSTED',
          createdById: req.user!.id,
        });
        await tx.insert(journalLines).values([
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: cashAcc.id, accountName: cashAcc.name, debit: amount, credit: 0, contactId: invoice.customerId, sortOrder: 0 },
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: arAcc.id, accountName: arAcc.name, debit: 0, credit: amount, contactId: invoice.customerId, sortOrder: 1 },
        ]);

        await tx.insert(salesPayments).values({
          id: paymentId, companyId: cId, invoiceId, paymentDate: new Date(paymentDate),
          amount, accountId, journalEntryId, notes: notes ?? null, createdById: req.user!.id,
        });

        await tx.update(salesInvoices)
          .set({ paidAmount: invoice.paidAmount + amount })
          .where(eq(salesInvoices.id, invoiceId));
      });

      res.status(201).json({ id: paymentId, journalEntryId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
