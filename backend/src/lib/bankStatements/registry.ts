import { BankConfig, Token } from './types';

/**
 * Config kolom per bank. Header alias dicocokkan case-insensitive terhadap teks token
 * baris header tabel. Kalau bank tidak ada di registry (atau gagal dideteksi), pipeline
 * jatuh ke GENERIC_CONFIG yang mengandalkan pencarian header dinamis.
 */
export const BCA_CONFIG: BankConfig = {
  id: 'BCA',
  label: 'BCA',
  namePatterns: [/bank\s+central\s+asia/i, /\bbca\b/i],
  columnAliases: {
    ignore: ['no', 'no.'],
    date: ['tanggal', 'tgl'],
    description: ['keterangan', 'uraian'],
    branch: ['cbg', 'cabang'],
    mutation: ['mutasi'],
    balance: ['saldo'],
  },
  // BCA e-statement khas: kolom "MUTASI" berisi nominal + suffix DB/CR digabung, mis. "50,000.00DB"
  combinedMutationColumn: true,
};

export const MANDIRI_CONFIG: BankConfig = {
  id: 'MANDIRI',
  label: 'Mandiri',
  namePatterns: [/bank\s+mandiri/i, /\bmandiri\b/i, /livin/i],
  columnAliases: {
    ignore: ['no', 'no.'],
    date: ['tanggal', 'date'],
    description: ['keterangan', 'remarks', 'uraian'],
    mutation: ['nominal', 'amount'],
    balance: ['saldo', 'balance'],
  },
  // e-statement Livin' by Mandiri khas: kolom "Nominal (IDR)" bertanda +/-, mis. "+155.000,00" / "-6.000,00"
  signedAmountColumn: true,
};

export const BNI_CONFIG: BankConfig = {
  id: 'BNI',
  label: 'BNI',
  namePatterns: [/bank\s+negara\s+indonesia/i, /\bbni\b/i],
  columnAliases: {
    ignore: ['no', 'no.'],
    date: ['tanggal', 'tgl'],
    description: ['keterangan', 'uraian'],
    branch: ['cabang', 'teller'],
    debit: ['debet', 'debit'],
    credit: ['kredit', 'credit'],
    balance: ['saldo'],
  },
};

export const GENERIC_CONFIG: BankConfig = {
  id: 'GENERIC',
  label: 'Bank Lainnya',
  namePatterns: [],
  columnAliases: {
    ignore: ['no', 'no.'],
    date: ['tanggal', 'tgl', 'date'],
    description: ['keterangan', 'uraian', 'description', 'remark', 'remarks'],
    branch: ['cabang', 'cbg', 'branch', 'teller'],
    debit: ['debet', 'debit'],
    credit: ['kredit', 'credit'],
    mutation: ['mutasi', 'mutation', 'amount', 'nominal'],
    balance: ['saldo', 'balance'],
  },
};

const REGISTRY: BankConfig[] = [BCA_CONFIG, MANDIRI_CONFIG, BNI_CONFIG];

/**
 * Deteksi bank dari token halaman pertama. `bankHint` (override manual dari user) menang
 * kalau ada dan valid; kalau tidak, coba cocokkan nama bank di teks; gagal semua -> GENERIC.
 */
export function detectBank(page1Tokens: Token[], bankHint?: string | null): BankConfig {
  if (bankHint) {
    const hinted = REGISTRY.find((b) => b.id.toLowerCase() === bankHint.toLowerCase());
    if (hinted) return hinted;
  }

  const joinedText = page1Tokens.map((t) => t.text).join(' ');
  for (const config of REGISTRY) {
    if (config.namePatterns.some((pattern) => pattern.test(joinedText))) {
      return config;
    }
  }

  return GENERIC_CONFIG;
}
