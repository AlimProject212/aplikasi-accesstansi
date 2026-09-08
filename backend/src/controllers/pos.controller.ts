import { Request, Response } from 'express';
import { eq, and, asc, desc, sql as dsql } from 'drizzle-orm';
import {
  db, posShifts, posTransactions, posTransactionLines, contacts, warehouses, users, products,
  inventorySettings, accounts, journalEntries, journalLines,
} from '../lib/prisma';
import { recordStockIn, recordStockOut } from '../services/inventory.service';

function paymentAccountKey(method: string): 'posCashAccountId' | 'posTransferAccountId' | 'posQrisAccountId' | 'posCardAccountId' {
  switch (method) {
    case 'CASH': return 'posCashAccountId';
    case 'TRANSFER': return 'posTransferAccountId';
    case 'QRIS': return 'posQrisAccountId';
    case 'CARD': return 'posCardAccountId';
    default: throw new Error('Metode pembayaran tidak valid');
  }
}

async function generateTransactionNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total }] = await db.select({ total: dsql<number>`COUNT(*)` }).from(posTransactions)
    .where(and(eq(posTransactions.companyId, companyId), dsql`YEAR(${posTransactions.transactionDate}) = ${year}`));
  const seq = (Number(total) || 0) + 1;
  return `POS-${year}-${String(seq).padStart(6, '0')}`;
}

async function fetchTransaction(id: string, companyId: number) {
  const [header] = await db.select({
    id: posTransactions.id,
    transactionNumber: posTransactions.transactionNumber,
    shiftId: posTransactions.shiftId,
    warehouseId: posTransactions.warehouseId,
    warehouseName: warehouses.name,
    cashierUserId: posTransactions.cashierUserId,
    cashierName: users.name,
    customerId: posTransactions.customerId,
    customerName: contacts.name,
    transactionDate: posTransactions.transactionDate,
    subtotal: posTransactions.subtotal,
    discount: posTransactions.discount,
    tax: posTransactions.tax,
    totalAmount: posTransactions.totalAmount,
    paymentMethod: posTransactions.paymentMethod,
    paidAmount: posTransactions.paidAmount,
    changeAmount: posTransactions.changeAmount,
    status: posTransactions.status,
    journalEntryId: posTransactions.journalEntryId,
    createdAt: posTransactions.createdAt,
  }).from(posTransactions)
    .leftJoin(warehouses, eq(posTransactions.warehouseId, warehouses.id))
    .leftJoin(users, eq(posTransactions.cashierUserId, users.id))
    .leftJoin(contacts, eq(posTransactions.customerId, contacts.id))
    .where(and(eq(posTransactions.id, id), eq(posTransactions.companyId, companyId))).limit(1);
  if (!header) return null;

  const lines = await db.select({
    id: posTransactionLines.id,
    productId: posTransactionLines.productId,
    productName: products.name,
    productSku: products.sku,
    qty: posTransactionLines.qty,
    unitPrice: posTransactionLines.unitPrice,
    discount: posTransactionLines.discount,
    unitCost: posTransactionLines.unitCost,
    lineTotal: posTransactionLines.lineTotal,
  }).from(posTransactionLines)
    .leftJoin(products, eq(posTransactionLines.productId, products.id))
    .where(eq(posTransactionLines.transactionId, id))
    .orderBy(asc(posTransactionLines.sortOrder));

  return { ...header, lines };
}

export const posController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { shiftId, status } = req.query;
      const list = await db.select({
        id: posTransactions.id,
        transactionNumber: posTransactions.transactionNumber,
        transactionDate: posTransactions.transactionDate,
        cashierName: users.name,
        totalAmount: posTransactions.totalAmount,
        paymentMethod: posTransactions.paymentMethod,
        status: posTransactions.status,
      }).from(posTransactions)
        .leftJoin(users, eq(posTransactions.cashierUserId, users.id))
        .where(and(
          eq(posTransactions.companyId, cId),
          shiftId ? eq(posTransactions.shiftId, shiftId as string) : undefined,
          status ? eq(posTransactions.status, status as any) : undefined,
        ))
        .orderBy(desc(posTransactions.transactionDate));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const tx = await fetchTransaction(req.params.id, req.user!.companyId);
      if (!tx) { res.status(404).json({ error: 'Transaksi tidak ditemukan' }); return; }
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/pos/checkout — transaksi langsung final: stok keluar + jurnal sekaligus */
  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { customerId, discount, tax, paymentMethod, paidAmount, lines } = req.body as {
        customerId?: string; discount?: number; tax?: number;
        paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS' | 'CARD'; paidAmount: number;
        lines: { productId: string; qty: number; unitPrice: number; discount?: number }[];
      };
      if (!paymentMethod) { res.status(400).json({ error: 'Metode pembayaran wajib diisi' }); return; }
      if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ error: 'Keranjang masih kosong' }); return; }

      const [shift] = await db.select().from(posShifts)
        .where(and(eq(posShifts.companyId, cId), eq(posShifts.cashierUserId, req.user!.id), eq(posShifts.status, 'OPEN')))
        .limit(1);
      if (!shift) { res.status(400).json({ error: 'Belum ada shift yang dibuka. Buka shift dulu sebelum transaksi.' }); return; }

      const settings = (await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1))[0];
      if (!settings?.inventoryAccountId || !settings?.salesRevenueAccountId || !settings?.cogsAccountId) {
        res.status(400).json({ error: 'Atur akun Persediaan, Pendapatan Penjualan & HPP dulu di Pengaturan Persediaan.' });
        return;
      }
      const payAccountId = settings[paymentAccountKey(paymentMethod)];
      if (!payAccountId) {
        res.status(400).json({ error: `Atur akun untuk metode pembayaran ${paymentMethod} dulu di Pengaturan Persediaan.` });
        return;
      }
      if (tax && tax > 0 && !settings.salesTaxAccountId) {
        res.status(400).json({ error: 'Transaksi ini ada pajak — atur dulu akun PPN Keluaran di Pengaturan Persediaan.' });
        return;
      }

      const disc = discount || 0;
      const taxAmt = tax || 0;
      const lineTotals = lines.map(l => (l.qty * l.unitPrice) - (l.discount || 0));
      const subtotal = lineTotals.reduce((s, v) => s + v, 0);
      const totalAmount = subtotal - disc + taxAmt;
      if (paidAmount < totalAmount) { res.status(400).json({ error: 'Jumlah bayar kurang dari total belanja' }); return; }
      const changeAmount = paidAmount - totalAmount;

      const transactionId = crypto.randomUUID();
      const transactionNumber = await generateTransactionNumber(cId);
      let journalEntryId: string | null = null;

      await db.transaction(async (tx) => {
        let totalCogs = 0;
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const { unitCost } = await recordStockOut(tx, {
            companyId: cId, productId: l.productId, warehouseId: shift.warehouseId,
            qty: l.qty, date: new Date(), refType: 'POS', refId: transactionId,
            description: `Transaksi kasir ${transactionNumber}`, createdById: req.user!.id,
          });
          totalCogs += l.qty * unitCost;
          await tx.insert(posTransactionLines).values({
            id: crypto.randomUUID(), transactionId, productId: l.productId,
            qty: l.qty, unitPrice: l.unitPrice, discount: l.discount || 0,
            unitCost, lineTotal: lineTotals[i], sortOrder: i,
          });
        }

        const [payAcc] = await tx.select().from(accounts).where(eq(accounts.id, payAccountId!)).limit(1);
        const [revAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.salesRevenueAccountId!)).limit(1);
        const [cogsAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.cogsAccountId!)).limit(1);
        const [invAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.inventoryAccountId!)).limit(1);

        const jLines: any[] = [
          { id: crypto.randomUUID(), accountId: payAcc.id, accountName: payAcc.name, debit: totalAmount, credit: 0, contactId: customerId ?? null, sortOrder: 0 },
          { id: crypto.randomUUID(), accountId: revAcc.id, accountName: revAcc.name, debit: 0, credit: subtotal - disc, contactId: customerId ?? null, sortOrder: 1 },
        ];
        let sort = 2;
        if (taxAmt > 0) {
          const [taxAcc] = await tx.select().from(accounts).where(eq(accounts.id, settings.salesTaxAccountId!)).limit(1);
          jLines.push({ id: crypto.randomUUID(), accountId: taxAcc.id, accountName: taxAcc.name, debit: 0, credit: taxAmt, sortOrder: sort++ });
        }
        jLines.push({ id: crypto.randomUUID(), accountId: cogsAcc.id, accountName: cogsAcc.name, debit: totalCogs, credit: 0, sortOrder: sort++ });
        jLines.push({ id: crypto.randomUUID(), accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: totalCogs, sortOrder: sort++ });

        journalEntryId = crypto.randomUUID();
        await tx.insert(journalEntries).values({
          id: journalEntryId, companyId: cId, transactionDate: new Date(),
          referenceNumber: transactionNumber, description: `Transaksi Kasir ${transactionNumber}`,
          totalAmount: totalAmount + totalCogs, status: 'POSTED', createdById: req.user!.id,
        });
        await tx.insert(journalLines).values(jLines.map(l => ({ ...l, journalId: journalEntryId })));

        await tx.insert(posTransactions).values({
          id: transactionId, companyId: cId, shiftId: shift.id, transactionNumber,
          warehouseId: shift.warehouseId, cashierUserId: req.user!.id, customerId: customerId ?? null,
          transactionDate: new Date(), subtotal, discount: disc, tax: taxAmt, totalAmount,
          paymentMethod, paidAmount, changeAmount, status: 'COMPLETED',
          journalEntryId, createdAt: new Date(),
        });
      });

      const created = await fetchTransaction(transactionId, cId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /** POST /api/pos/:id/void — batalkan transaksi: stok balik + jurnal pembalik */
  async void(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [txRow] = await db.select().from(posTransactions)
        .where(and(eq(posTransactions.id, req.params.id), eq(posTransactions.companyId, cId))).limit(1);
      if (!txRow) { res.status(404).json({ error: 'Transaksi tidak ditemukan' }); return; }
      if (txRow.status !== 'COMPLETED') { res.status(400).json({ error: 'Transaksi ini sudah di-void' }); return; }

      const lines = await db.select().from(posTransactionLines).where(eq(posTransactionLines.transactionId, txRow.id));
      const originalLines = txRow.journalEntryId
        ? await db.select().from(journalLines).where(eq(journalLines.journalId, txRow.journalEntryId)).orderBy(asc(journalLines.sortOrder))
        : [];

      let voidJournalId: string | null = null;

      await db.transaction(async (tx) => {
        for (const line of lines) {
          await recordStockIn(tx, {
            companyId: cId, productId: line.productId, warehouseId: txRow.warehouseId,
            qty: line.qty, unitCost: line.unitCost, date: new Date(),
            refType: 'POS', refId: txRow.id,
            description: `Void transaksi kasir ${txRow.transactionNumber}`,
            createdById: req.user!.id,
          });
        }

        if (originalLines.length > 0) {
          const newJournalId = crypto.randomUUID();
          voidJournalId = newJournalId;
          await tx.insert(journalEntries).values({
            id: newJournalId, companyId: cId, transactionDate: new Date(),
            referenceNumber: `VOID-${txRow.transactionNumber}`,
            description: `Void Transaksi Kasir ${txRow.transactionNumber}`,
            totalAmount: originalLines.reduce((s, l) => s + l.debit, 0),
            status: 'POSTED', createdById: req.user!.id,
          });
          await tx.insert(journalLines).values(originalLines.map((l, i) => ({
            id: crypto.randomUUID(), journalId: newJournalId,
            accountId: l.accountId, accountName: l.accountName,
            debit: l.credit, credit: l.debit, contactId: l.contactId, sortOrder: i,
          })));
        }

        await tx.update(posTransactions)
          .set({ status: 'VOID', voidJournalEntryId: voidJournalId })
          .where(eq(posTransactions.id, txRow.id));
      });

      const voided = await fetchTransaction(txRow.id, cId);
      res.json(voided);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
