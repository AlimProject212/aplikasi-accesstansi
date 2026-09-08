/** Satu kata/fragmen teks hasil ekstraksi PDF (text layer) atau OCR, dengan posisi di halaman. */
export interface Token {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  /** 0-100, hanya ada kalau token berasal dari OCR */
  confidence?: number;
}

export type StatementSourceMode = 'digital' | 'ocr';

export type ColumnKey = 'date' | 'description' | 'branch' | 'debit' | 'credit' | 'mutation' | 'balance' | 'ignore';

export interface BankConfig {
  id: string; // 'BCA' | 'MANDIRI' | 'BNI' | 'GENERIC'
  label: string;
  namePatterns: RegExp[];
  columnAliases: Partial<Record<ColumnKey, string[]>>;
  /** true kalau bank ini pakai 1 kolom "Mutasi" berisi nominal + suffix DB/CR (mis. "50.000,00DB"), bukan kolom debit/kredit terpisah */
  combinedMutationColumn?: boolean;
  /** true kalau bank ini pakai 1 kolom nominal bertanda +/- (mis. Livin' by Mandiri: "+155.000,00" / "-6.000,00") */
  signedAmountColumn?: boolean;
}

export interface ParsedRow {
  page: number;
  cells: Partial<Record<ColumnKey, string>>;
  /** confidence token OCR (0-100) yang menyusun baris ini; kosong kalau sumbernya text-layer PDF asli */
  confidences?: number[];
}

export interface ExtractedTransaction {
  id: string;
  date: string; // ISO yyyy-mm-dd, kosong string kalau gagal parse
  rawDate: string;
  description: string;
  branch: string;
  amount: number;
  type: 'DB' | 'CR';
  balance: number;
  needsReview: boolean;
  reviewReason?: string;
  ocrConfidence?: number; // rata-rata confidence token baris ini, kalau dari OCR
  suggestedAccountId: string | null;
}

export interface ReconciliationSummary {
  initialBalance: number;
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  isBalanced: boolean;
}

export interface ParseResult {
  bankDetected: string;
  transactions: ExtractedTransaction[];
  reconciliation: ReconciliationSummary;
}
