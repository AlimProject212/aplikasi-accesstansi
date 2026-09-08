import { apiFetch } from './api';
import { analyzeStatementFile } from '../utils/bankStatementFile';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export interface ExtractedTransaction {
  id: string;
  date: string;
  rawDate: string;
  description: string;
  branch: string;
  amount: number;
  type: 'DB' | 'CR';
  balance: number;
  needsReview: boolean;
  reviewReason?: string;
  ocrConfidence?: number;
  suggestedAccountId: string | null;
}

export interface ReconciliationSummary {
  initialBalance: number;
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  isBalanced: boolean;
}

export interface ParseStatementResult {
  bankDetected: string;
  transactions: ExtractedTransaction[];
  reconciliation: ReconciliationSummary;
}

export interface BankStatementKeyword {
  id: number;
  keyword: string;
  matchCount: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  updatedAt: string;
}

async function postMultipart(path: string, formData: FormData): Promise<any> {
  const token = localStorage.getItem('accesstansi_token');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    // Jangan set Content-Type — biarkan browser set multipart boundary otomatis
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Gagal memproses dokumen.');
  }
  return res.json();
}

export const bankStatementsService = {
  /**
   * Analisis file di browser (deteksi digital vs scan via pdfjs) lalu upload ke backend
   * untuk diproses jadi transaksi ternormalisasi + saran akun COA.
   */
  async parse(file: File, bankHint?: string, password?: string): Promise<ParseStatementResult> {
    const analyzed = await analyzeStatementFile(file, password);

    const formData = new FormData();
    formData.append('mode', analyzed.mode);
    formData.append('file', file);
    if (bankHint) formData.append('bankHint', bankHint);

    if (analyzed.mode === 'digital') {
      formData.append('textLayer', JSON.stringify(analyzed.textLayer));
    } else {
      (analyzed.pageImages || []).forEach((blob, idx) => {
        formData.append('pageImages', blob, `page-${idx + 1}.png`);
      });
    }

    return postMultipart('/api/bank-statements/parse', formData);
  },

  /** Perkuat kamus keyword->akun COA setelah user posting hasil review ke jurnal. */
  reinforceKeywords: (entries: { accountId: string; description: string }[]): Promise<void> =>
    apiFetch<void>('/api/bank-statements/keywords/reinforce', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),

  /** Ambil kamus keyword->akun COA (halaman kelola, opsional). */
  getKeywords: (): Promise<BankStatementKeyword[]> =>
    apiFetch<BankStatementKeyword[]>('/api/bank-statements/keywords'),
};
