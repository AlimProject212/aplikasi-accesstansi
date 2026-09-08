import { BankConfig, ColumnKey, ParsedRow, Token } from './types';
import { looksLikeDate } from './normalize';

interface ColumnBoundary {
  key: ColumnKey;
  xStart: number;
  xEnd: number;
}

/** Kelompokkan token jadi baris berdasarkan kedekatan koordinat Y (per halaman). */
export function groupTokensIntoRows(tokens: Token[]): Token[][] {
  const sorted = [...tokens].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  if (!sorted.length) return [];

  const avgHeight = sorted.reduce((s, t) => s + (t.height || 10), 0) / sorted.length;
  const tolerance = Math.max(avgHeight * 0.6, 3);

  const rows: Token[][] = [];
  for (const token of sorted) {
    const last = rows[rows.length - 1];
    if (last && last[0].page === token.page && Math.abs(avgY(last) - token.y) <= tolerance) {
      last.push(token);
    } else {
      rows.push([token]);
    }
  }
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));
  return rows;
}

function avgY(row: Token[]): number {
  return row.reduce((s, t) => s + t.y, 0) / row.length;
}

/** Cocokkan teks satu token ke salah satu kolom logis (date/description/debit/dst) via alias config bank. */
export function matchColumnAlias(text: string, config: BankConfig): ColumnKey | null {
  const lower = text.toLowerCase().trim().replace(/[:.]/g, '');
  if (!lower) return null;
  for (const [key, aliases] of Object.entries(config.columnAliases) as [ColumnKey, string[]][]) {
    for (const alias of aliases) {
      const aliasWords = alias.split(' ');
      if (lower === alias || aliasWords.includes(lower) || alias.includes(lower) || lower.includes(alias)) {
        return key;
      }
    }
  }
  return null;
}

function isLikelyHeaderRow(row: Token[], config: BankConfig): boolean {
  const matchedKeys = row.map((t) => matchColumnAlias(t.text, config)).filter(Boolean) as ColumnKey[];
  if (!matchedKeys.length) return false;
  const uniqueKeys = new Set(matchedKeys);
  // Header row: hampir semua token di baris itu cocok jadi nama kolom, dan minimal ada date+description
  const matchRatio = matchedKeys.length / row.length;
  return matchRatio >= 0.6 && uniqueKeys.has('date') && uniqueKeys.has('description');
}

/** Cari baris header pertama yang cocok pola kolom bank ini; kembalikan batas X tiap kolom. */
export function findHeaderRow(rows: Token[][], config: BankConfig): { rowIndex: number; boundaries: ColumnBoundary[] } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const matched: ColumnBoundary[] = [];
    for (const token of row) {
      const key = matchColumnAlias(token.text, config);
      if (key) matched.push({ key, xStart: token.x, xEnd: token.x + token.width });
    }
    const keys = new Set(matched.map((m) => m.key));
    const hasAmountColumn = keys.has('debit') || keys.has('credit') || keys.has('mutation');
    if (keys.has('date') && keys.has('description') && hasAmountColumn) {
      return { rowIndex: i, boundaries: matched };
    }
  }
  return null;
}

/** Ubah posisi header (titik) jadi rentang X per kolom (titik tengah antar-header jadi batas). */
function normalizeBoundaries(boundaries: ColumnBoundary[]): ColumnBoundary[] {
  const sorted = [...boundaries].sort((a, b) => a.xStart - b.xStart);
  const result: ColumnBoundary[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const left = i === 0 ? -Infinity : (sorted[i - 1].xStart + sorted[i].xStart) / 2;
    const right = i === sorted.length - 1 ? Infinity : (sorted[i].xStart + sorted[i + 1].xStart) / 2;
    result.push({ key: sorted[i].key, xStart: left, xEnd: right });
  }
  return result;
}

function assignRowToColumns(row: Token[], boundaries: ColumnBoundary[]): ParsedRow {
  const cells: Partial<Record<ColumnKey, string>> = {};
  const confidences: number[] = [];
  for (const token of row) {
    const centerX = token.x + token.width / 2;
    const col = boundaries.find((b) => centerX >= b.xStart && centerX < b.xEnd);
    if (!col) continue;
    cells[col.key] = cells[col.key] ? `${cells[col.key]} ${token.text}`.trim() : token.text;
    if (typeof token.confidence === 'number') confidences.push(token.confidence);
  }
  return { page: row[0].page, cells, confidences: confidences.length ? confidences : undefined };
}

/** Gabungkan beberapa sub-baris (1 transaksi yang teksnya nyebar ke beberapa baris, mis. Keterangan 3 baris) jadi 1 ParsedRow, per-kolom digabung berurutan. */
function mergeBlock(block: ParsedRow[]): ParsedRow {
  const cells: Partial<Record<ColumnKey, string>> = {};
  const confidences: number[] = [];
  for (const sub of block) {
    for (const key of Object.keys(sub.cells) as ColumnKey[]) {
      const val = sub.cells[key];
      if (!val) continue;
      cells[key] = cells[key] ? `${cells[key]} ${val}`.trim() : val;
    }
    if (sub.confidences) confidences.push(...sub.confidences);
  }
  return { page: block[0].page, cells, confidences: confidences.length ? confidences : undefined };
}

/**
 * Rekonstruksi tabel dari token mentah: cari header sekali di dokumen, pakai batas kolomnya
 * untuk semua baris data (termasuk lintas halaman), lalu lewati baris header yang berulang
 * di tiap halaman berikutnya. Baris yang teksnya nyebar ke beberapa baris visual (mis. kolom
 * Keterangan 2-3 baris per transaksi) digabung jadi 1 transaksi memakai kolom tanggal sebagai
 * penanda mulainya transaksi baru — baris tanpa tanggal dianggap lanjutan transaksi sebelumnya.
 */
export function reconstructTable(tokens: Token[], config: BankConfig): { dataRows: ParsedRow[]; headerFound: boolean } {
  const rows = groupTokensIntoRows(tokens);
  const headerMatch = findHeaderRow(rows, config);
  if (!headerMatch) return { dataRows: [], headerFound: false };

  const boundaries = normalizeBoundaries(headerMatch.boundaries);
  const headerPage = rows[headerMatch.rowIndex][0].page;

  const dataTokenRows = rows.filter((row, idx) => {
    if (idx === headerMatch.rowIndex) return false;
    if (row[0].page === headerPage && idx < headerMatch.rowIndex) return false;
    if (isLikelyHeaderRow(row, config)) return false;
    return true;
  });

  const subRows = dataTokenRows.map((row) => assignRowToColumns(row, boundaries));

  const blocks: ParsedRow[][] = [];
  for (const sub of subRows) {
    const startsNewTransaction = looksLikeDate(sub.cells.date || '') || blocks.length === 0;
    if (startsNewTransaction) {
      blocks.push([sub]);
    } else {
      blocks[blocks.length - 1].push(sub);
    }
  }

  const dataRows = blocks.map(mergeBlock);
  return { dataRows, headerFound: true };
}
