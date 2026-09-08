import { Request, Response } from 'express';
import { eq, asc, and, inArray } from 'drizzle-orm';
import { db, companyProfile, appConfig, accounts, contacts, journalEntries, journalLines, accountBudgets, fiscalYears, lockedMonths, users } from '../lib/prisma';

export const settingsController = {
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      // get-or-create singleton (id = companyId)
      await db.insert(companyProfile)
        .values({ id: cId, name: 'Perusahaan Saya', address: '', city: '', phone: '', email: '' })
        .onDuplicateKeyUpdate({ set: { id: cId } });
      const [profile] = await db.select().from(companyProfile).where(eq(companyProfile.id, cId)).limit(1);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, address, city, phone, email, website, taxId, logoUrl, signerName, signerTitle } = req.body;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (website !== undefined) updateData.website = website;
      if (taxId !== undefined) updateData.taxId = taxId;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (signerName !== undefined) updateData.signerName = signerName;
      if (signerTitle !== undefined) updateData.signerTitle = signerTitle;

      await db.insert(companyProfile)
        .values({
          id: cId,
          name: name || 'Perusahaan Saya',
          address: address || '', city: city || '',
          phone: phone || '', email: email || '',
          website: website ?? null, taxId: taxId ?? null, logoUrl: logoUrl ?? null,
          signerName: signerName ?? null, signerTitle: signerTitle ?? null,
        })
        .onDuplicateKeyUpdate({ set: updateData });
      const [profile] = await db.select().from(companyProfile).where(eq(companyProfile.id, cId)).limit(1);
      res.json(profile);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      await db.insert(appConfig)
        .values({ id: cId, lockDate: '', fiscalYearStartMonth: 1, activePeriod: new Date().getFullYear().toString() })
        .onDuplicateKeyUpdate({ set: { lockDate: '' } });
      const [config] = await db.select().from(appConfig).where(eq(appConfig.id, cId)).limit(1);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { lockDate, fiscalYearStartMonth, activePeriod, onboardingCompleted } = req.body;
      const updateData: Record<string, any> = {};
      if (lockDate !== undefined) updateData.lockDate = lockDate;
      if (fiscalYearStartMonth !== undefined) updateData.fiscalYearStartMonth = fiscalYearStartMonth;
      if (activePeriod !== undefined) updateData.activePeriod = activePeriod;
      if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;

      await db.insert(appConfig)
        .values({
          id: cId,
          lockDate: lockDate || '',
          fiscalYearStartMonth: fiscalYearStartMonth ?? 1,
          activePeriod: activePeriod || new Date().getFullYear().toString(),
          onboardingCompleted: onboardingCompleted ?? true,
        })
        .onDuplicateKeyUpdate({ set: updateData });
      const [config] = await db.select().from(appConfig).where(eq(appConfig.id, cId)).limit(1);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async backup(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;

      // Fetch journals (company) + lines
      const journalList = await db.select().from(journalEntries)
        .where(eq(journalEntries.companyId, cId));
      let journalsWithLines: any[] = [];
      if (journalList.length > 0) {
        const jIds = journalList.map(j => j.id);
        const allLines = await db.select().from(journalLines)
          .where(inArray(journalLines.journalId, jIds))
          .orderBy(asc(journalLines.sortOrder));
        const linesByJ: Record<string, typeof allLines> = {};
        for (const l of allLines) {
          if (!linesByJ[l.journalId]) linesByJ[l.journalId] = [];
          linesByJ[l.journalId].push(l);
        }
        journalsWithLines = journalList.map(j => ({ ...j, lines: linesByJ[j.id] ?? [] }));
      }

      // Fetch fiscal years (company) + locked months
      const yearList = await db.select().from(fiscalYears)
        .where(eq(fiscalYears.companyId, cId));
      let periodsWithMonths: any[] = [];
      if (yearList.length > 0) {
        const fyIds = yearList.map(y => y.id);
        const allMonths = await db.select().from(lockedMonths)
          .where(inArray(lockedMonths.fiscalYearId, fyIds));
        const monthsByFY: Record<number, typeof allMonths> = {};
        for (const m of allMonths) {
          if (!monthsByFY[m.fiscalYearId]) monthsByFY[m.fiscalYearId] = [];
          monthsByFY[m.fiscalYearId].push(m);
        }
        periodsWithMonths = yearList.map(y => ({ ...y, lockedMonths: monthsByFY[y.id] ?? [] }));
      }

      const [accs, conts, budgets, profileArr, configArr, usrs] = await Promise.all([
        db.select().from(accounts)
          .where(eq(accounts.companyId, cId))
          .orderBy(asc(accounts.level), asc(accounts.code)),
        db.select().from(contacts)
          .where(eq(contacts.companyId, cId)),
        db.select().from(accountBudgets)
          .where(eq(accountBudgets.companyId, cId)),
        db.select().from(companyProfile).where(eq(companyProfile.id, cId)),
        db.select().from(appConfig).where(eq(appConfig.id, cId)),
        db.select({
          id: users.id, name: users.name, email: users.email, role: users.role,
          isActive: users.isActive, canManageUsers: users.canManageUsers,
          canManageSettings: users.canManageSettings, canManageCOA: users.canManageCOA,
          canEntryJournal: users.canEntryJournal, canApproveJournal: users.canApproveJournal,
          canDeleteJournal: users.canDeleteJournal, canViewReports: users.canViewReports,
        }).from(users).where(eq(users.companyId, cId)),
      ]);

      res.json({
        exportedAt: new Date().toISOString(),
        version: '2.0',
        companyId: cId,
        accounts: accs,
        contacts: conts,
        journals: journalsWithLines,
        budgets,
        profile: profileArr[0] ?? null,
        config: configArr[0] ?? null,
        periods: periodsWithMonths,
        users: usrs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
