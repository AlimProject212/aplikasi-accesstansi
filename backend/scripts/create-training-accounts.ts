/**
 * Script: Buat 15 akun training AccessTansi
 * Usage: npx tsx scripts/create-training-accounts.ts
 *
 * Akun yang dibuat:
 *   Email    : latih001@accesstansi.id ~ latih015@accesstansi.id
 *   Password : LATIH001 ~ LATIH015
 *   Role     : VIEWER (read-only, aman untuk training)
 *   Company  : STAI-ASTA (companyId = 1)
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/lib/prisma';

async function main() {
  const conn = await pool.getConnection();

  console.log('🔧 Membuat 15 akun training...\n');

  const results: { email: string; password: string; status: string }[] = [];

  for (let i = 1; i <= 15; i++) {
    const num      = String(i).padStart(3, '0');          // "001", "002", ...
    const email    = `latih${num}@accesstansi.id`;
    const password = `LATIH${num}`;                       // e.g. LATIH001
    const name     = `Peserta Training ${num}`;

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      await conn.query(
        `INSERT INTO users
           (companyId, name, email, passwordHash, role,
            canManageUsers, canManageSettings, canManageCOA,
            canEntryJournal, canApproveJournal, canDeleteJournal, canViewReports,
            isActive, loginAttempts, createdAt, updatedAt)
         VALUES
           (1, ?, ?, ?, 'VIEWER',
            0, 0, 0,
            0, 0, 0, 1,
            1, 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           passwordHash = VALUES(passwordHash),
           name         = VALUES(name),
           isActive     = 1`,
        [name, email, passwordHash]
      );
      results.push({ email, password, status: '✅ OK' });
    } catch (err: any) {
      results.push({ email, password, status: `❌ ${err.message}` });
    }
  }

  conn.release();

  // ── Print hasil ──────────────────────────────────────────────────────────────
  console.log('┌─────────────────────────────────────┬──────────────┬────────┐');
  console.log('│ Email                               │ Password     │ Status │');
  console.log('├─────────────────────────────────────┼──────────────┼────────┤');
  for (const r of results) {
    const email = r.email.padEnd(35);
    const pass  = r.password.padEnd(12);
    console.log(`│ ${email} │ ${pass} │ ${r.status}  │`);
  }
  console.log('└─────────────────────────────────────┴──────────────┴────────┘');
  console.log(`\n✅ Selesai! ${results.filter(r => r.status.startsWith('✅')).length}/15 akun berhasil dibuat.`);
  console.log('\nInfo Login:');
  console.log('  URL      : https://app.accesstansi.id');
  console.log('  Email    : latih001@accesstansi.id s/d latih015@accesstansi.id');
  console.log('  Password : LATIH001 s/d LATIH015');
  console.log('  Role     : VIEWER (read-only)\n');

  await pool.end();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
