import crypto from 'crypto';
import { BankConfig, ExtractedTransaction, ParsedRow } from './types';
import { parseIndoAmount, parseIndoDate } from './normalize';

export interface RawParseOutput {
  transactions: ExtractedTransaction[];
  declaredInitialBalance: number | null;
}

const OCR_LOW_CONFIDENCE_THRESHOLD = 70;

/** Ubah baris hasil rekonstruksi tabel jadi transaksi ternormalisasi. Baris non-transaksi (header ulang, total, footer, baris kosong) dilewati. */
export function parseRowsToTransactions(rows: ParsedRow[], config: BankConfig): RawParseOutput {
  const transactions: ExtractedTransaction[] = [];
  let declaredInitialBalance: number | null = null;

  for (const row of rows) {
    const dateRaw = (row.cells.date || '').trim();
    const descRaw = (row.cells.description || '').trim();
    const balanceRaw = (row.cells.balance || '').trim();

    // Baris "Saldo Awal" biasanya tidak punya tanggal transaksi, cuma keterangan + saldo
    if (!dateRaw && /saldo\s*awal/i.test(descRaw)) {
      const bal = parseIndoAmount(balanceRaw);
      if (bal !== null) declaredInitialBalance = bal;
      continue;
    }

    const isoDate = parseIndoDate(dateRaw);
    if (!isoDate) continue; // bukan baris transaksi (kosong, "bersambung", total, dst)

    const balance = parseIndoAmount(balanceRaw);
    if (balance === null) continue;

    let amount: number | null = null;
    let type: 'DB' | 'CR' | null = null;

    if (config.combinedMutationColumn) {
      const mutationRaw = (row.cells.mutation || '').trim();
      const m = mutationRaw.match(/^(.*?)(DB|CR)$/i);
      if (m) {
        amount = parseIndoAmount(m[1]);
        type = m[2].toUpperCase() as 'DB' | 'CR';
      }
    } else if (config.signedAmountColumn) {
      const mutationRaw = (row.cells.mutation || '').trim();
      const parsed = parseIndoAmount(mutationRaw);
      if (parsed !== null && parsed !== 0) {
        amount = Math.abs(parsed);
        type = parsed < 0 ? 'DB' : 'CR';
      }
    } else {
      const debit = parseIndoAmount(row.cells.debit || '');
      const credit = parseIndoAmount(row.cells.credit || '');
      if (debit !== null && debit > 0) {
        amount = debit;
        type = 'DB';
      } else if (credit !== null && credit > 0) {
        amount = credit;
        type = 'CR';
      }
    }

    // Fallback generik: bank tak dikenal (jatuh ke GENERIC_CONFIG) tapi tabelnya ternyata
    // pakai 1 kolom nominal gabungan (bukan debit/kredit terpisah) -> coba deteksi otomatis
    // baik pola suffix DB/CR maupun tanda +/- di depan.
    if (amount === null && row.cells.mutation) {
      const mutationRaw = row.cells.mutation.trim();
      const suffixMatch = mutationRaw.match(/^(.*?)(DB|CR)$/i);
      if (suffixMatch) {
        amount = parseIndoAmount(suffixMatch[1]);
        type = suffixMatch[2].toUpperCase() as 'DB' | 'CR';
      } else {
        const signed = parseIndoAmount(mutationRaw);
        if (signed !== null && signed !== 0) {
          amount = Math.abs(signed);
          type = signed < 0 ? 'DB' : 'CR';
        }
      }
    }

    if (amount === null || type === null || amount === 0) continue;

    const ocrConfidence = row.confidences?.length
      ? row.confidences.reduce((s, c) => s + c, 0) / row.confidences.length
      : undefined;

    transactions.push({
      id: crypto.randomUUID(),
      date: isoDate,
      rawDate: dateRaw,
      description: descRaw || '(tanpa keterangan)',
      branch: (row.cells.branch || '').trim(),
      amount,
      type,
      balance,
      needsReview: ocrConfidence !== undefined && ocrConfidence < OCR_LOW_CONFIDENCE_THRESHOLD,
      reviewReason: ocrConfidence !== undefined && ocrConfidence < OCR_LOW_CONFIDENCE_THRESHOLD
        ? 'Hasil OCR kurang yakin, mohon dicek manual'
        : undefined,
      ocrConfidence,
      suggestedAccountId: null,
    });
  }

  return { transactions, declaredInitialBalance };
}
