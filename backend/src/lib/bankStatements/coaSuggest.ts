import { eq, sql } from 'drizzle-orm';
import { bankStatementKeywords, db } from '../prisma';

export interface KeywordEntry {
  keyword: string;
  accountId: string;
}

/** Ambil kamus keyword->akun milik company, diurutkan supaya keyword paling spesifik (terpanjang, paling sering dipakai) dicoba duluan. */
export async function loadKeywordDictionary(companyId: number): Promise<KeywordEntry[]> {
  const rows = await db
    .select({ keyword: bankStatementKeywords.keyword, accountId: bankStatementKeywords.accountId, matchCount: bankStatementKeywords.matchCount })
    .from(bankStatementKeywords)
    .where(eq(bankStatementKeywords.companyId, companyId));

  return rows
    .sort((a, b) => b.keyword.length - a.keyword.length || b.matchCount - a.matchCount)
    .map((r) => ({ keyword: r.keyword, accountId: r.accountId }));
}

/** Cocokkan deskripsi transaksi ke kamus (substring, case-insensitive). Null kalau tidak ketemu. */
export function suggestAccountForDescription(description: string, dict: KeywordEntry[]): string | null {
  const lower = description.toLowerCase();
  for (const entry of dict) {
    if (entry.keyword && lower.includes(entry.keyword)) return entry.accountId;
  }
  return null;
}

/**
 * Bersihkan deskripsi transaksi mentah (yang sering berisi kode referensi/nomor acak) jadi
 * frasa keyword yang lebih stabil buat disimpan ke kamus. Membuang token yang isinya
 * digit/simbol saja atau terlalu pendek.
 */
export function cleanDescriptionForKeyword(description: string): string {
  const words = description
    .split(/\s+/)
    .filter((w) => w.length >= 3 && /[a-zA-Z]/.test(w) && !/^[0-9\/\-.]+$/.test(w));
  return words.join(' ').toLowerCase().trim().slice(0, 80);
}

/** Simpan/perkuat pasangan keyword->akun (dipanggil setelah user posting & konfirmasi akun per transaksi). */
export async function reinforceKeywords(companyId: number, entries: { accountId: string; description: string }[]): Promise<void> {
  for (const entry of entries) {
    const keyword = cleanDescriptionForKeyword(entry.description);
    if (!keyword) continue;

    await db
      .insert(bankStatementKeywords)
      .values({ companyId, accountId: entry.accountId, keyword, matchCount: 1 })
      .onDuplicateKeyUpdate({
        set: {
          accountId: entry.accountId,
          matchCount: sql`${bankStatementKeywords.matchCount} + 1`,
        },
      });
  }
}
