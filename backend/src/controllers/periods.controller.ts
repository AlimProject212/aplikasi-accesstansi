import { Request, Response } from 'express';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db, fiscalYears, lockedMonths, appConfig } from '../lib/prisma';

// Fetch fiscal year with its locked months — scoped by companyId
async function fetchFiscalYearWithMonths(year: string, companyId: number) {
  const [fy] = await db.select().from(fiscalYears)
    .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, companyId))).limit(1);
  if (!fy) return null;
  const months = await db.select().from(lockedMonths).where(eq(lockedMonths.fiscalYearId, fy.id));
  return { ...fy, lockedMonths: months };
}

export const periodsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const years = await db.select().from(fiscalYears)
        .where(eq(fiscalYears.companyId, cId))
        .orderBy(desc(fiscalYears.year));

      if (years.length === 0) { res.json([]); return; }

      const fyIds = years.map(y => y.id);
      const months = await db.select().from(lockedMonths)
        .where(inArray(lockedMonths.fiscalYearId, fyIds));

      const monthsByFY: Record<number, typeof months> = {};
      for (const m of months) {
        if (!monthsByFY[m.fiscalYearId]) monthsByFY[m.fiscalYearId] = [];
        monthsByFY[m.fiscalYearId].push(m);
      }

      const result = years.map(y => ({ ...y, lockedMonths: monthsByFY[y.id] ?? [] }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year } = req.body;
      const [existing] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId))).limit(1);
      if (existing) { res.status(400).json({ error: `Tahun ${year} sudah ada` }); return; }

      await db.insert(fiscalYears).values({ year, companyId: cId, isActive: false });
      const [fy] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId))).limit(1);
      res.status(201).json({ ...fy, lockedMonths: [] });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year } = req.params;
      const [fy] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId))).limit(1);
      if (!fy) { res.status(404).json({ error: 'Tahun tidak ditemukan' }); return; }
      if (fy.isActive) { res.status(400).json({ error: 'Tidak bisa hapus periode aktif' }); return; }
      await db.delete(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async setActive(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year } = req.params;
      // Deactivate hanya fiscal years milik company ini, lalu activate yang dipilih
      await db.update(fiscalYears).set({ isActive: false })
        .where(eq(fiscalYears.companyId, cId));
      await db.update(fiscalYears).set({ isActive: true })
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId)));

      // Sync ke AppConfig (id = companyId)
      await db.insert(appConfig)
        .values({ id: cId, activePeriod: year, lockDate: '', fiscalYearStartMonth: 1 })
        .onDuplicateKeyUpdate({ set: { activePeriod: year } });

      const fy = await fetchFiscalYearWithMonths(year, cId);
      res.json(fy);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async lockMonth(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year } = req.params;
      const { month } = req.body; // "2025-03"
      const [fy] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId))).limit(1);
      if (!fy) { res.status(404).json({ error: 'Tahun tidak ditemukan' }); return; }

      await db.insert(lockedMonths)
        .values({ yearMonth: month, fiscalYearId: fy.id })
        .onDuplicateKeyUpdate({ set: { yearMonth: month } });

      const [locked] = await db.select().from(lockedMonths)
        .where(and(
          eq(lockedMonths.yearMonth, month),
          eq(lockedMonths.fiscalYearId, fy.id),
        )).limit(1);
      res.status(201).json(locked);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async unlockMonth(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year, yearMonth } = req.params;
      // Scope unlock ke fiscal year milik company ini
      const [fy] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
        .where(and(eq(fiscalYears.year, year), eq(fiscalYears.companyId, cId))).limit(1);
      if (!fy) { res.status(404).json({ error: 'Tahun tidak ditemukan' }); return; }

      await db.delete(lockedMonths)
        .where(and(
          eq(lockedMonths.yearMonth, yearMonth),
          eq(lockedMonths.fiscalYearId, fy.id),
        ));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
