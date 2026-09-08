import { Request, Response } from 'express';
import { eq, and, or, like, gte, lte, desc, asc, inArray } from 'drizzle-orm';
import { db, journalEntries, journalLines, users } from '../lib/prisma';

// Helper: format journal for frontend compatibility
function formatJournal(j: any) {
  return {
    ...j,
    transactionDate: j.transactionDate instanceof Date
      ? j.transactionDate.toISOString().split('T')[0]
      : String(j.transactionDate).split('T')[0],
    createdAt: j.createdAt instanceof Date
      ? j.createdAt.toISOString()
      : j.createdAt,
    createdBy: j.createdBy?.name ?? j.createdBy ?? null,
  };
}

// Fetch one journal with lines + createdBy (scoped by companyId)
async function fetchJournal(id: string, companyId?: number) {
  const cond = companyId
    ? and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId))
    : eq(journalEntries.id, id);
  const [journal] = await db.select().from(journalEntries).where(cond).limit(1);
  if (!journal) return null;

  const [lines, creatorRows] = await Promise.all([
    db.select().from(journalLines)
      .where(eq(journalLines.journalId, id))
      .orderBy(asc(journalLines.sortOrder)),
    db.select({ id: users.id, name: users.name }).from(users)
      .where(eq(users.id, journal.createdById)).limit(1),
  ]);

  return { ...journal, lines, createdBy: creatorRows[0] ?? null };
}

// Batch-fetch journals with lines + createdBy (avoids N+1 problem)
async function fetchJournalsBatch(journalList: any[]) {
  if (journalList.length === 0) return [];

  const ids = journalList.map(j => j.id);
  const userIds = [...new Set<number>(journalList.map(j => j.createdById))];

  const [lines, userList] = await Promise.all([
    db.select().from(journalLines)
      .where(inArray(journalLines.journalId, ids))
      .orderBy(asc(journalLines.sortOrder)),
    db.select({ id: users.id, name: users.name }).from(users)
      .where(inArray(users.id, userIds)),
  ]);

  const linesByJournal: Record<string, typeof lines> = {};
  for (const l of lines) {
    if (!linesByJournal[l.journalId]) linesByJournal[l.journalId] = [];
    linesByJournal[l.journalId].push(l);
  }

  const usersById: Record<number, { id: number; name: string }> = {};
  for (const u of userList) usersById[u.id] = u;

  return journalList.map(j => ({
    ...j,
    lines: linesByJournal[j.id] ?? [],
    createdBy: usersById[j.createdById] ?? null,
  }));
}

export const journalsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status, from, to, search, period } = req.query;
      const p = period as string | undefined;
      const s = search ? `%${search}%` : null;

      const journalList = await db.select().from(journalEntries)
        .where(and(
          eq(journalEntries.companyId, cId),
          status ? eq(journalEntries.status, status as any) : undefined,
          p
            ? and(
                gte(journalEntries.transactionDate, new Date(`${p}-01-01`)),
                lte(journalEntries.transactionDate, new Date(`${p}-12-31`)),
              )
            : and(
                from ? gte(journalEntries.transactionDate, new Date(from as string)) : undefined,
                to ? lte(journalEntries.transactionDate, new Date(`${to as string}T23:59:59.999Z`)) : undefined,
              ),
          s ? or(
            like(journalEntries.description, s),
            like(journalEntries.referenceNumber, s),
          ) : undefined,
        ))
        .orderBy(desc(journalEntries.transactionDate));

      const result = await fetchJournalsBatch(journalList);
      res.json(result.map(formatJournal));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const journal = await fetchJournal(req.params.id, req.user!.companyId);
      if (!journal) { res.status(404).json({ error: 'Jurnal tidak ditemukan' }); return; }
      res.json(formatJournal(journal));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id, transactionDate, referenceNumber, description, lines, status, attachment, attachmentName } = req.body;

      // Validate debit = credit
      const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        res.status(400).json({ error: `Total debit (${totalDebit}) tidak sama dengan total kredit (${totalCredit})` });
        return;
      }

      const journalId = id || crypto.randomUUID();

      await db.transaction(async (tx) => {
        await tx.insert(journalEntries).values({
          id: journalId,
          companyId: cId,
          transactionDate: new Date(transactionDate),
          referenceNumber: referenceNumber ?? '',
          description: description ?? '',
          attachment: attachment || null,
          attachmentName: attachmentName || null,
          totalAmount: totalDebit,
          status: status || 'DRAFT',
          createdById: req.user!.id,
        });

        if (lines.length > 0) {
          await tx.insert(journalLines).values(
            lines.map((l: any, i: number) => ({
              id: l.id || crypto.randomUUID(),
              journalId,
              accountId: l.accountId,
              accountName: l.accountName,
              debit: l.debit || 0,
              credit: l.credit || 0,
              contactId: l.contactId || null,
              contactName: l.contactName || null,
              description: l.description || null,
              sortOrder: i,
            })),
          );
        }
      });

      const journal = await fetchJournal(journalId, cId);
      res.status(201).json(formatJournal(journal));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [existing] = await db.select().from(journalEntries)
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Jurnal tidak ditemukan' }); return; }
      if (existing.status !== 'DRAFT') {
        res.status(400).json({ error: 'Hanya jurnal DRAFT yang bisa diedit' });
        return;
      }

      const { transactionDate, referenceNumber, description, lines, status, attachment, attachmentName } = req.body;

      if (lines) {
        const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
        const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          res.status(400).json({ error: `Total debit (${totalDebit}) tidak sama dengan total kredit (${totalCredit})` });
          return;
        }

        await db.transaction(async (tx) => {
          const updateData: Record<string, any> = { totalAmount: totalDebit };
          if (transactionDate) updateData.transactionDate = new Date(transactionDate);
          if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber;
          if (description !== undefined) updateData.description = description;
          if (attachment !== undefined) updateData.attachment = attachment;
          if (attachmentName !== undefined) updateData.attachmentName = attachmentName;
          if (status && ['DRAFT', 'POSTED', 'VOID'].includes(status)) updateData.status = status;

          await tx.update(journalEntries).set(updateData)
            .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId)));

          // Delete old lines and recreate
          await tx.delete(journalLines).where(eq(journalLines.journalId, req.params.id));

          if (lines.length > 0) {
            await tx.insert(journalLines).values(
              lines.map((l: any, i: number) => ({
                id: l.id || crypto.randomUUID(),
                journalId: req.params.id,
                accountId: l.accountId,
                accountName: l.accountName,
                debit: l.debit || 0,
                credit: l.credit || 0,
                contactId: l.contactId || null,
                contactName: l.contactName || null,
                description: l.description || null,
                sortOrder: i,
              })),
            );
          }
        });
      } else {
        const updateData: Record<string, any> = {};
        if (transactionDate) updateData.transactionDate = new Date(transactionDate);
        if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber;
        if (description !== undefined) updateData.description = description;
        if (attachment !== undefined) updateData.attachment = attachment;
        if (attachmentName !== undefined) updateData.attachmentName = attachmentName;
        if (status && ['DRAFT', 'POSTED', 'VOID'].includes(status)) updateData.status = status;

        if (Object.keys(updateData).length > 0) {
          await db.update(journalEntries).set(updateData)
            .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId)));
        }
      }

      const updated = await fetchJournal(req.params.id, cId);
      res.json(formatJournal(updated));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  // Dedicated attachment endpoint — works for any status (DRAFT/POSTED/VOID)
  async updateAttachment(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { attachment, attachmentName } = req.body;
      const [existing] = await db.select({ id: journalEntries.id })
        .from(journalEntries)
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Jurnal tidak ditemukan' }); return; }

      await db.update(journalEntries)
        .set({ attachment: attachment ?? null, attachmentName: attachmentName ?? null })
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId)));

      const updated = await fetchJournal(req.params.id, cId);
      res.json(formatJournal(updated));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  // SUPERADMIN-only: force delete regardless of status (DRAFT/POSTED/VOID) or period lock
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [journal] = await db.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId))).limit(1);
      if (!journal) { res.status(404).json({ error: 'Jurnal tidak ditemukan' }); return; }
      // journalLines cascade-delete via FK
      await db.delete(journalEntries)
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  // SUPERADMIN-only: mass delete, same force-delete rules as single delete
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'Daftar ID jurnal kosong' });
        return;
      }

      const [result] = await db.delete(journalEntries)
        .where(and(inArray(journalEntries.id, ids), eq(journalEntries.companyId, cId)));

      res.json({ deleted: (result as any).affectedRows ?? ids.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { status } = req.body;
      const [journal] = await db.select().from(journalEntries)
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId))).limit(1);
      if (!journal) { res.status(404).json({ error: 'Jurnal tidak ditemukan' }); return; }

      // Validate status transitions
      const allowed: Record<string, string[]> = {
        DRAFT: ['POSTED'],
        POSTED: ['VOID'],
        VOID: [],
      };
      if (!allowed[journal.status]?.includes(status)) {
        res.status(400).json({ error: `Tidak bisa ubah status dari ${journal.status} ke ${status}` });
        return;
      }

      await db.update(journalEntries)
        .set({ status })
        .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.companyId, cId)));

      const updated = await fetchJournal(req.params.id, cId);
      res.json(formatJournal(updated));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
