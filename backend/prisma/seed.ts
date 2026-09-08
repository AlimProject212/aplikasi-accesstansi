/**
 * Seed script — dua mode:
 * 1. Fresh seed:  npx tsx prisma/seed.ts
 * 2. Dari backup: npx tsx prisma/seed.ts --from-backup=./AccessTansi_Backup_YYYY-MM-DD.json
 */

import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { db, pool, users, companyProfile, appConfig, fiscalYears, lockedMonths, accounts, contacts, journalEntries, journalLines, accountBudgets } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const backupArg = process.argv.find(a => a.startsWith('--from-backup='));
  const backupPath = backupArg ? backupArg.split('=')[1] : null;

  // ─── 1. Create default SUPERADMIN ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);
  await db.insert(users).values({
    name: 'Administrator',
    email: 'admin@accesstansi.com',
    passwordHash,
    role: 'SUPERADMIN',
    canManageUsers: true,
    canManageSettings: true,
    canManageCOA: true,
    canEntryJournal: true,
    canApproveJournal: true,
    canDeleteJournal: true,
    canViewReports: true,
  }).onDuplicateKeyUpdate({ set: { role: 'SUPERADMIN' } });

  const [admin] = await db.select().from(users)
    .where(eq(users.email, 'admin@accesstansi.com')).limit(1);
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── 2. Ensure singleton settings ────────────────────────────────────────────
  await db.insert(companyProfile)
    .values({ id: 1, name: 'Perusahaan Saya', address: '', city: '', phone: '', email: '' })
    .onDuplicateKeyUpdate({ set: { id: 1 } });

  const currentYear = new Date().getFullYear().toString();
  await db.insert(appConfig)
    .values({ id: 1, lockDate: '', fiscalYearStartMonth: 1, activePeriod: currentYear })
    .onDuplicateKeyUpdate({ set: { id: 1 } });

  await db.insert(fiscalYears)
    .values({ year: currentYear, isActive: true })
    .onDuplicateKeyUpdate({ set: { isActive: true } });

  // ─── 3. If backup file provided, migrate data ────────────────────────────────
  if (backupPath) {
    const resolvedPath = path.resolve(backupPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Backup file tidak ditemukan: ${resolvedPath}`);
      process.exit(1);
    }

    const backup = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    console.log(`📦 Migrasi dari backup: ${resolvedPath}`);

    // Company profile
    if (backup.profile) {
      const p = backup.profile;
      await db.insert(companyProfile)
        .values({ id: 1, name: p.name || 'Perusahaan Saya', address: p.address || '', city: p.city || '', phone: p.phone || '', email: p.email || '', website: p.website ?? null, taxId: p.taxId ?? null, logoUrl: p.logoUrl ?? null })
        .onDuplicateKeyUpdate({ set: backup.profile });
      console.log(`  ✅ Company profile`);
    }

    // App config
    if (backup.config) {
      const c = backup.config;
      await db.insert(appConfig)
        .values({ id: 1, lockDate: c.lockDate || '', fiscalYearStartMonth: c.fiscalYearStartMonth ?? 1, activePeriod: c.activePeriod || currentYear })
        .onDuplicateKeyUpdate({ set: backup.config });
      console.log(`  ✅ App config`);
    }

    // Chart of Accounts — sort by level agar parent selalu ada sebelum child
    const rawCoa: any[] = backup.accounts ?? [];
    if (rawCoa.length) {
      const sorted = [...rawCoa].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
      for (const acc of sorted) {
        const { children, ...data } = acc;
        await db.insert(accounts).values({
          id: data.id,
          code: data.code,
          name: data.name,
          type: data.type,
          level: data.level,
          parentId: data.parentId ?? null,
          balance: data.balance ?? 0,
          isHeader: data.isHeader ?? false,
          cashFlowCategory: data.cashFlowCategory ?? null,
        }).onDuplicateKeyUpdate({ set: { name: data.name } });
      }
      console.log(`  ✅ Chart of Accounts: ${sorted.length} akun`);
    }

    // Contacts
    const bContacts: any[] = backup.contacts ?? [];
    for (const c of bContacts) {
      await db.insert(contacts).values({
        id: c.id,
        name: c.name,
        type: c.type,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        taxId: c.taxId ?? null,
        notes: c.notes ?? null,
      }).onDuplicateKeyUpdate({ set: { name: c.name } });
    }
    if (bContacts.length) console.log(`  ✅ Contacts: ${bContacts.length}`);

    // Journal Entries + Lines
    const bJournals: any[] = backup.journals ?? [];
    for (const j of bJournals) {
      try {
        const [existing] = await db.select().from(journalEntries)
          .where(eq(journalEntries.id, j.id)).limit(1);
        if (!existing) {
          await db.insert(journalEntries).values({
            id: j.id,
            transactionDate: new Date(j.transactionDate),
            referenceNumber: j.referenceNumber || '',
            description: j.description || '',
            totalAmount: j.totalAmount ?? 0,
            status: j.status ?? 'DRAFT',
            createdById: admin.id,
          });
          const jLines = (j.lines ?? []).map((l: any, i: number) => ({
            id: l.id || crypto.randomUUID(),
            journalId: j.id,
            accountId: l.accountId,
            accountName: l.accountName,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            contactId: l.contactId ?? null,
            contactName: l.contactName ?? null,
            description: l.description ?? null,
            sortOrder: i,
          }));
          if (jLines.length > 0) {
            await db.insert(journalLines).values(jLines);
          }
        }
      } catch (e: any) {
        console.warn(`  ⚠️  Skip jurnal ${j.referenceNumber}: ${e.message}`);
      }
    }
    if (bJournals.length) console.log(`  ✅ Journals: ${bJournals.length}`);

    // Budgets
    const bBudgets: any[] = backup.budgets ?? [];
    for (const b of bBudgets) {
      await db.insert(accountBudgets).values({
        accountId: b.accountId,
        fiscalYear: currentYear,
        annualAmount: b.annualAmount ?? 0,
      }).onDuplicateKeyUpdate({ set: { annualAmount: b.annualAmount ?? 0 } });
    }
    if (bBudgets.length) console.log(`  ✅ Budgets: ${bBudgets.length}`);

    // Periods
    const bPeriods: any[] = backup.periods ?? [];
    for (const p of bPeriods) {
      const yearStr = typeof p === 'string' ? p : p.year;
      await db.insert(fiscalYears).values({
        year: yearStr,
        isActive: yearStr === currentYear,
      }).onDuplicateKeyUpdate({ set: { year: yearStr } });
    }
    if (bPeriods.length) console.log(`  ✅ Fiscal years: ${bPeriods.length}`);

    // Locked months
    const bLockedMonths: string[] = backup.lockedMonths ?? backup.locked_months ?? [];
    for (const ym of bLockedMonths) {
      const yearStr = ym.split('-')[0];
      const [fy] = await db.select().from(fiscalYears)
        .where(eq(fiscalYears.year, yearStr)).limit(1);
      if (fy) {
        await db.insert(lockedMonths).values({ yearMonth: ym, fiscalYearId: fy.id })
          .onDuplicateKeyUpdate({ set: { yearMonth: ym } });
      }
    }

    console.log('');
    console.log('✅ Migrasi selesai!');
  } else {
    console.log('✅ Fresh seed selesai!');
  }

  console.log('');
  console.log('🔑 Default login:');
  console.log('   Email   : admin@accesstansi.com');
  console.log('   Password: admin123');
  console.log('   ⚠️  Ganti password setelah login pertama!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await pool.end(); });
