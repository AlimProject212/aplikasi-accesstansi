import { Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, fundRequests, journalEntries, journalLines, accounts } from '../lib/prisma';

// ─── Helper: row DB → FundRequest shape (dengan nested `realization`) ─────────
function toFundRequest(row: typeof fundRequests.$inferSelect) {
  const {
    realizationId,
    realizationDate,
    realizationActualAmount,
    realizationExpenseLines,
    realizationRefundAccountId,
    realizationNotes,
    realizationJournalId,
    ...rest
  } = row;

  return {
    ...rest,
    realization: realizationId
      ? {
          id:              realizationId,
          requestId:       row.id,
          date:            realizationDate,
          actualAmount:    realizationActualAmount,
          expenseLines:    realizationExpenseLines
                             ? JSON.parse(realizationExpenseLines)
                             : [],
          refundAccountId: realizationRefundAccountId,
          notes:           realizationNotes,
          journalEntryId:  realizationJournalId,
          receiptUrls:     [],
          status:          'POSTED' as const,
        }
      : undefined,
  };
}

export const fundRequestsController = {

  /** GET /api/fund-requests */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      // KARYAWAN hanya bisa lihat pengajuan milik sendiri
      const isKaryawan = req.user?.role === 'KARYAWAN';
      const rows = isKaryawan
        ? await db.select().from(fundRequests)
            .where(and(
              eq(fundRequests.companyId, cId),
              eq(fundRequests.employeeId, String(req.user!.id)),
            ))
            .orderBy(desc(fundRequests.createdAt))
        : await db.select().from(fundRequests)
            .where(eq(fundRequests.companyId, cId))
            .orderBy(desc(fundRequests.createdAt));
      res.json(rows.map(toFundRequest));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/fund-requests */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { employeeId, employeeName, employeeRole, date, purpose, amountRequested } = req.body;
      if (!employeeId || !employeeName || !date || !purpose || !amountRequested) {
        res.status(400).json({ error: 'Semua field wajib diisi.' });
        return;
      }

      const id = `REQ-${Date.now()}`;
      await db.insert(fundRequests).values({
        id,
        companyId: cId,
        employeeId,
        employeeName,
        employeeRole: employeeRole ?? null,
        date,
        purpose,
        amountRequested: Number(amountRequested),
        status: 'PENDING',
      });

      const [created] = await db
        .select()
        .from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)))
        .limit(1);

      res.status(201).json(toFundRequest(created));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PATCH /api/fund-requests/:id/approve */
  async approve(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id } = req.params;
      const { debitAccountId, creditAccountId } = req.body;

      if (!debitAccountId || !creditAccountId) {
        res.status(400).json({ error: 'Harap pilih akun Debet dan Kredit.' });
        return;
      }

      const [row] = await db
        .select()
        .from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)))
        .limit(1);
      if (!row) { res.status(404).json({ error: 'Pengajuan tidak ditemukan.' }); return; }
      if (row.status !== 'PENDING') {
        res.status(400).json({ error: 'Hanya pengajuan PENDING yang bisa disetujui.' });
        return;
      }

      const [debitAcc] = await db.select().from(accounts)
        .where(and(eq(accounts.id, debitAccountId), eq(accounts.companyId, cId))).limit(1);
      const [creditAcc] = await db.select().from(accounts)
        .where(and(eq(accounts.id, creditAccountId), eq(accounts.companyId, cId))).limit(1);
      if (!debitAcc || !creditAcc) {
        res.status(400).json({ error: 'Akun debet atau kredit tidak ditemukan.' });
        return;
      }

      // Buat Journal Entry
      const journalId   = `JV-FUND-${Date.now()}`;
      const createdById = req.user?.id ?? 1;

      await db.insert(journalEntries).values({
        id:              journalId,
        companyId:       cId,
        transactionDate: new Date(),
        referenceNumber: `CA-${id}`,
        description:     `Pemberian Dana (Cash Advance) - ${row.purpose}`,
        totalAmount:     row.amountRequested,
        status:          'POSTED',
        createdById,
      });

      await db.insert(journalLines).values([
        {
          id:          randomUUID(),
          journalId,
          accountId:   debitAcc.id,
          accountName: `${debitAcc.code} - ${debitAcc.name}`,
          debit:       row.amountRequested,
          credit:      0,
          description: `Uang Muka: ${row.purpose} (${row.employeeName})`,
          sortOrder:   1,
        },
        {
          id:          randomUUID(),
          journalId,
          accountId:   creditAcc.id,
          accountName: `${creditAcc.code} - ${creditAcc.name}`,
          debit:       0,
          credit:      row.amountRequested,
          description: `Pembayaran Uang Muka: ${row.purpose}`,
          sortOrder:   2,
        },
      ]);

      // Update status fund request
      await db.update(fundRequests).set({
        status:         'APPROVED',
        approvedBy:     req.user?.email ?? 'Supervisor',
        approvedAt:     new Date().toISOString(),
        debitAccountId,
        creditAccountId,
        journalEntryId: journalId,
      }).where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)));

      const [updated] = await db.select().from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId))).limit(1);
      res.json(toFundRequest(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PATCH /api/fund-requests/:id/reject */
  async reject(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason?.trim()) {
        res.status(400).json({ error: 'Alasan penolakan wajib diisi.' });
        return;
      }

      const [row] = await db
        .select()
        .from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)))
        .limit(1);
      if (!row) { res.status(404).json({ error: 'Pengajuan tidak ditemukan.' }); return; }
      if (row.status !== 'PENDING') {
        res.status(400).json({ error: 'Hanya pengajuan PENDING yang bisa ditolak.' });
        return;
      }

      await db.update(fundRequests).set({
        status:         'REJECTED',
        approvedBy:     req.user?.email ?? 'Supervisor',
        approvedAt:     new Date().toISOString(),
        rejectionReason,
      }).where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)));

      const [updated] = await db.select().from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId))).limit(1);
      res.json(toFundRequest(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PATCH /api/fund-requests/:id/realize */
  async realize(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id } = req.params;
      const {
        actualAmount,
        expenseLines,
        refundAccountId,
        notes,
      } = req.body as {
        actualAmount:    number;
        expenseLines:    { accountId: string; amount: number }[];
        refundAccountId?: string;
        notes?:          string;
      };

      if (!actualAmount || !expenseLines?.length) {
        res.status(400).json({ error: 'Jumlah aktual dan alokasi biaya wajib diisi.' });
        return;
      }

      const [row] = await db
        .select()
        .from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)))
        .limit(1);
      if (!row) { res.status(404).json({ error: 'Pengajuan tidak ditemukan.' }); return; }
      if (row.status !== 'APPROVED') {
        res.status(400).json({ error: 'Hanya pengajuan APPROVED yang bisa direalisasikan.' });
        return;
      }

      // Akun uang muka (dari saat approval)
      const advanceAcc = row.debitAccountId
        ? (await db.select().from(accounts)
            .where(and(eq(accounts.id, row.debitAccountId), eq(accounts.companyId, cId))).limit(1))[0]
        : null;
      if (!advanceAcc) {
        res.status(400).json({ error: 'Akun uang muka tidak ditemukan.' });
        return;
      }

      const totalAllocated = expenseLines.reduce((s, l) => s + Number(l.amount), 0);
      const diff           = row.amountRequested - totalAllocated;

      // Buat Settlement Journal Entry
      const journalId   = `JV-SETTLE-${Date.now()}`;
      const createdById = req.user?.id ?? 1;
      const maxAmount   = Math.max(Number(actualAmount), row.amountRequested);

      await db.insert(journalEntries).values({
        id:              journalId,
        companyId:       cId,
        transactionDate: new Date(),
        referenceNumber: `SET-${id}`,
        description:     `Realisasi Dana - ${row.purpose}`,
        totalAmount:     maxAmount,
        status:          'POSTED',
        createdById,
      });

      // Bangun journal lines
      const lines: any[] = [];
      let sortOrder = 1;

      // Expense lines
      for (const line of expenseLines) {
        const [acc] = await db.select().from(accounts)
          .where(and(eq(accounts.id, line.accountId), eq(accounts.companyId, cId))).limit(1);
        if (acc) {
          lines.push({
            id:          randomUUID(),
            journalId,
            accountId:   acc.id,
            accountName: `${acc.code} - ${acc.name}`,
            debit:       Number(line.amount),
            credit:      0,
            description: `Realisasi: ${row.purpose} (${row.employeeName})`,
            sortOrder:   sortOrder++,
          });
        }
      }

      // Sisa dana dikembalikan (totalAllocated < amountRequested)
      if (diff > 0 && refundAccountId) {
        const [refundAcc] = await db.select().from(accounts)
          .where(and(eq(accounts.id, refundAccountId), eq(accounts.companyId, cId))).limit(1);
        if (refundAcc) {
          lines.push({
            id:          randomUUID(),
            journalId,
            accountId:   refundAcc.id,
            accountName: `${refundAcc.code} - ${refundAcc.name}`,
            debit:       diff,
            credit:      0,
            description: `Pengembalian Sisa Dana: ${row.purpose}`,
            sortOrder:   sortOrder++,
          });
        }
      }

      // Hapus uang muka (kredit akun advance)
      lines.push({
        id:          randomUUID(),
        journalId,
        accountId:   advanceAcc.id,
        accountName: `${advanceAcc.code} - ${advanceAcc.name}`,
        debit:       0,
        credit:      row.amountRequested,
        description: `Penyelesaian Uang Muka: ${row.purpose}`,
        sortOrder:   sortOrder++,
      });

      // Reimbursement (totalAllocated > amountRequested)
      if (diff < 0 && refundAccountId) {
        const [refundAcc] = await db.select().from(accounts)
          .where(and(eq(accounts.id, refundAccountId), eq(accounts.companyId, cId))).limit(1);
        if (refundAcc) {
          lines.push({
            id:          randomUUID(),
            journalId,
            accountId:   refundAcc.id,
            accountName: `${refundAcc.code} - ${refundAcc.name}`,
            debit:       0,
            credit:      Math.abs(diff),
            description: `Pembayaran Selisih Dana: ${row.purpose}`,
            sortOrder:   sortOrder++,
          });
        }
      }

      if (lines.length > 0) {
        await db.insert(journalLines).values(lines);
      }

      // Update fund request ke COMPLETED
      const realizationId = `REAL-${Date.now()}`;
      await db.update(fundRequests).set({
        status:                     'COMPLETED',
        realizationId,
        realizationDate:            new Date().toISOString().split('T')[0],
        realizationActualAmount:    totalAllocated,
        realizationExpenseLines:    JSON.stringify(expenseLines),
        realizationRefundAccountId: refundAccountId ?? null,
        realizationNotes:           notes ?? null,
        realizationJournalId:       journalId,
      }).where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId)));

      const [updated] = await db.select().from(fundRequests)
        .where(and(eq(fundRequests.id, id), eq(fundRequests.companyId, cId))).limit(1);
      res.json(toFundRequest(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
