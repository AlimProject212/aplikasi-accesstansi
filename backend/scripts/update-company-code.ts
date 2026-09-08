/**
 * Script satu kali: ganti Company ID di database
 *
 * Cara pakai:
 *   npx tsx scripts/update-company-code.ts ACCS-0001 STAI-ASTA
 *
 * Pastikan file .env sudah ada dengan DATABASE_URL yang benar
 */

import 'dotenv/config';
import { db, companies } from '../src/lib/prisma';
import { eq } from 'drizzle-orm';

async function main() {
  const oldCode = (process.argv[2] || '').trim().toUpperCase();
  const newCode = (process.argv[3] || '').trim().toUpperCase();

  if (!oldCode || !newCode) {
    console.error('❌  Usage: npx tsx scripts/update-company-code.ts OLD_CODE NEW_CODE');
    console.error('    Contoh: npx tsx scripts/update-company-code.ts ACCS-0001 STAI-ASTA');
    process.exit(1);
  }

  console.log(`\n🔍  Mencari company dengan kode: ${oldCode} ...`);

  // Cari company lama
  const [target] = await db
    .select({ id: companies.id, name: companies.name, code: companies.code })
    .from(companies)
    .where(eq(companies.code, oldCode))
    .limit(1);

  if (!target) {
    console.error(`❌  Company dengan kode "${oldCode}" tidak ditemukan di database.`);
    process.exit(1);
  }

  console.log(`✅  Ditemukan: [${target.code}] ${target.name}  (id=${target.id})`);

  // Cek apakah kode baru sudah dipakai
  const [conflict] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.code, newCode))
    .limit(1);

  if (conflict) {
    console.error(`❌  Kode "${newCode}" sudah dipakai oleh company lain: [${conflict.name}]`);
    process.exit(1);
  }

  // Lakukan update
  console.log(`\n✏️   Mengubah kode: ${oldCode}  →  ${newCode} ...`);

  await db
    .update(companies)
    .set({ code: newCode })
    .where(eq(companies.code, oldCode));

  // Verifikasi
  const [updated] = await db
    .select({ id: companies.id, name: companies.name, code: companies.code })
    .from(companies)
    .where(eq(companies.code, newCode))
    .limit(1);

  if (updated) {
    console.log(`\n✅  Berhasil! Company ID sekarang: ${updated.code}  (${updated.name})`);
    console.log(`\n💡  Login sekarang pakai Company ID: ${updated.code}`);
  } else {
    console.error('⚠️   Update dijalankan tapi verifikasi gagal. Cek manual di database.');
  }
}

main()
  .catch((err) => {
    console.error('❌  Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    // Tutup pool koneksi
    const { pool } = await import('../src/lib/prisma');
    await pool.end();
  });
