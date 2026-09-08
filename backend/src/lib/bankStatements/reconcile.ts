import { ExtractedTransaction, ReconciliationSummary } from './types';

const BALANCE_TOLERANCE = 1; // toleransi Rp1 buat pembulatan

/**
 * Validasi saldo berjalan tiap baris (saldo_ini = saldo_sebelumnya ± amount) dan hitung
 * ringkasan rekonsiliasi keseluruhan dokumen. Menandai `needsReview` di transaksi yang
 * saldo berjalannya tidak nyambung (indikasi salah baca kolom debit/kredit/saldo).
 */
export function reconcileTransactions(
  transactions: ExtractedTransaction[],
  declaredInitialBalance: number | null
): ReconciliationSummary {
  let totalDebit = 0;
  let totalCredit = 0;
  let prevBalance: number | null = null;

  for (const tx of transactions) {
    if (tx.type === 'DB') totalDebit += tx.amount;
    else totalCredit += tx.amount;

    if (prevBalance !== null) {
      const expected = tx.type === 'CR' ? prevBalance + tx.amount : prevBalance - tx.amount;
      if (Math.abs(expected - tx.balance) > BALANCE_TOLERANCE) {
        tx.needsReview = true;
        tx.reviewReason = tx.reviewReason || 'Saldo berjalan tidak sesuai perhitungan, kemungkinan salah baca kolom';
      }
    }
    prevBalance = tx.balance;
  }

  const finalBalance = transactions.length
    ? transactions[transactions.length - 1].balance
    : declaredInitialBalance ?? 0;
  const initialBalance = declaredInitialBalance ?? finalBalance - totalCredit + totalDebit;
  const calcBalance = initialBalance + totalCredit - totalDebit;
  const isBalanced = Math.abs(calcBalance - finalBalance) <= BALANCE_TOLERANCE;

  return { initialBalance, totalDebit, totalCredit, finalBalance, isBalanced };
}
