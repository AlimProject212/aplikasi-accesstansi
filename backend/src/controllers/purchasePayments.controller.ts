import { Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, purchasePayments, goodsReceipts, contacts, accounts, inventorySettings, journalEntries, journalLines } from '../lib/prisma';

export const purchasePaymentsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { receiptId } = req.query;
      const list = await db.select({
        id: purchasePayments.id,
        receiptId: purchasePayments.receiptId,
        receiptNumber: goodsReceipts.receiptNumber,
        vendorName: contacts.name,
        paymentDate: purchasePayments.paymentDate,
        amount: purchasePayments.amount,
        accountId: purchasePayments.accountId,
        accountName: accounts.name,
        notes: purchasePayments.notes,
        createdAt: purchasePayments.createdAt,
      }).from(purchasePayments)
        .leftJoin(goodsReceipts, eq(purchasePayments.receiptId, goodsReceipts.id))
        .leftJoin(contacts, eq(goodsReceipts.vendorId, contacts.id))
        .leftJoin(accounts, eq(purchasePayments.accountId, accounts.id))
        .where(and(
          eq(purchasePayments.companyId, cId),
          receiptId ? eq(purchasePayments.receiptId, receiptId as string) : undefined,
        ))
        .orderBy(desc(purchasePayments.paymentDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { receiptId, paymentDate, amount, accountId, notes } = req.body as {
        receiptId: string; paymentDate: string; amount: number; accountId: string; notes?: string;
      };
      if (!receiptId || !paymentDate || !amount || amount <= 0 || !accountId) {
        res.status(400).json({ error: 'receiptId, paymentDate, amount, dan accountId wajib diisi' });
        return;
      }

      const [receipt] = await db.select().from(goodsReceipts)
        .where(and(eq(goodsReceipts.id, receiptId), eq(goodsReceipts.companyId, cId))).limit(1);
      if (!receipt) { res.status(404).json({ error: 'Penerimaan barang tidak ditemukan' }); return; }
      if (receipt.status !== 'POSTED') { res.status(400).json({ error: 'Hanya penerimaan barang yang sudah diposting bisa dibayar' }); return; }

      const remaining = receipt.totalAmount - receipt.paidAmount;
      if (amount > remaining + 0.01) {
        res.status(400).json({ error: `Jumlah bayar (${amount}) melebihi sisa hutang (${remaining})` });
        return;
      }

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      if (!settings?.payableAccountId) {
        res.status(400).json({ error: 'Atur akun Hutang Usaha dulu di Pengaturan Persediaan.' });
        return;
      }

      const paymentId = crypto.randomUUID();
      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        const [payAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.payableAccountId!)).limit(1);
        const [cashAcc] = await tx.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.companyId, cId))).limit(1);
        if (!cashAcc) throw new Error('Akun kas/bank tidak ditemukan');

        journalEntryId = crypto.randomUUID();
        await tx.insert(journalEntries).values({
          id: journalEntryId,
          companyId: cId,
          transactionDate: new Date(paymentDate),
          referenceNumber: `PAY-${receipt.receiptNumber}`,
          description: `Pembayaran Hutang — ${receipt.receiptNumber}`,
          totalAmount: amount,
          status: 'POSTED',
          createdById: req.user!.id,
        });
        await tx.insert(journalLines).values([
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: payAcc.id, accountName: payAcc.name, debit: amount, credit: 0, contactId: receipt.vendorId, sortOrder: 0 },
          { id: crypto.randomUUID(), journalId: journalEntryId, accountId: cashAcc.id, accountName: cashAcc.name, debit: 0, credit: amount, contactId: receipt.vendorId, sortOrder: 1 },
        ]);

        await tx.insert(purchasePayments).values({
          id: paymentId, companyId: cId, receiptId, paymentDate: new Date(paymentDate),
          amount, accountId, journalEntryId, notes: notes ?? null, createdById: req.user!.id,
        });

        await tx.update(goodsReceipts)
          .set({ paidAmount: receipt.paidAmount + amount })
          .where(eq(goodsReceipts.id, receiptId));
      });

      res.status(201).json({ id: paymentId, journalEntryId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
