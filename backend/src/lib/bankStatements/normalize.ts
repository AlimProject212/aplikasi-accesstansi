const INDO_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

/**
 * Parse berbagai format tanggal rekening koran Indonesia jadi ISO yyyy-mm-dd. Return '' kalau gagal.
 * Regex dicari di mana saja dalam string (bukan full-match) karena sel tanggal hasil rekonstruksi
 * tabel kadang kebawa teks tambahan (jam transaksi, nomor urut baris yang salah kecantol kolom).
 */
export function parseIndoDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // dd/mm/yy atau dd/mm/yyyy atau dd-mm-yy(yy)
  let m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (isValidDate(day, month, year)) return toIso(day, month, year);
  }

  // dd-MMM-yyyy atau dd MMM yyyy (mis. 01-Jan-2024, 01 Jan 2024, 02 Nov 2025 12:34:24 WIB)
  m = s.match(/(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{4}|\d{2})\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase().slice(0, 3);
    const month = INDO_MONTHS[monthKey];
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month && isValidDate(day, month, year)) return toIso(day, month, year);
  }

  // yyyy-mm-dd (sudah ISO)
  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const year = parseInt(m[1], 10), month = parseInt(m[2], 10), day = parseInt(m[3], 10);
    if (isValidDate(day, month, year)) return toIso(day, month, year);
  }

  return '';
}

/** Cek cepat (tanpa validasi penuh) apakah sebuah teks kemungkinan mengandung tanggal — dipakai untuk mendeteksi baris awal transaksi baru saat merge multi-baris. */
export function looksLikeDate(raw: string): boolean {
  if (!raw) return false;
  return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(raw) || /\d{1,2}[\s\-][A-Za-z]{3,}[\s\-]\d{2,4}/.test(raw);
}

function isValidDate(day: number, month: number, year: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1970 && year <= 2100;
}

function toIso(day: number, month: number, year: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Parse angka format Indonesia ("1.234.567,89" atau "1,234,567.89" atau "50000.00") jadi number.
 * Return null kalau string kosong / tidak mengandung digit sama sekali.
 */
export function parseIndoAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d.,\-]/g, '');
  if (!s || !/\d/.test(s)) return null;

  const isNegative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // koma = desimal (format ID: 1.234.567,89)
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // titik = desimal, kecuali polanya jelas ribuan (mis. 1.234.567 tanpa koma sama sekali & 3 digit tiap grup)
    const groups = s.split('.');
    const looksLikeThousands = groups.length > 2 || (groups.length === 2 && groups[1].length === 3);
    normalized = looksLikeThousands ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }

  const n = parseFloat(normalized);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}
