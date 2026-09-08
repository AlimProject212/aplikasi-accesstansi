import { ParseResult, Token } from './types';
import { detectBank } from './registry';
import { reconstructTable } from './layout';
import { parseRowsToTransactions } from './parseRows';
import { reconcileTransactions } from './reconcile';
import { loadKeywordDictionary, suggestAccountForDescription } from './coaSuggest';

/**
 * Orkestrasi penuh: token (dari text-layer PDF atau OCR) -> deteksi bank -> rekonstruksi
 * tabel -> normalisasi transaksi -> validasi saldo berjalan -> saran akun COA.
 */
export async function runBankStatementPipeline(
  companyId: number,
  tokens: Token[],
  bankHint?: string | null
): Promise<ParseResult> {
  const page1Tokens = tokens.filter((t) => t.page === 1);
  const config = detectBank(page1Tokens, bankHint);

  const { dataRows, headerFound } = reconstructTable(tokens, config);
  if (!headerFound) {
    throw new Error(
      'Gagal mendeteksi struktur tabel rekening koran. Coba pilih bank secara manual atau pastikan dokumen tidak terpotong/buram.'
    );
  }

  const { transactions, declaredInitialBalance } = parseRowsToTransactions(dataRows, config);
  if (!transactions.length) {
    throw new Error('Tidak ada transaksi yang berhasil diekstrak dari dokumen ini.');
  }

  const dict = await loadKeywordDictionary(companyId);
  for (const tx of transactions) {
    tx.suggestedAccountId = suggestAccountForDescription(tx.description, dict);
  }

  const reconciliation = reconcileTransactions(transactions, declaredInitialBalance);

  return { bankDetected: config.id, transactions, reconciliation };
}
