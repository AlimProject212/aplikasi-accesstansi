import React, { useEffect, useRef, useState } from 'react';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, Send, Landmark,
} from 'lucide-react';
import { HierarchicalAccount, JournalEntry, JournalLine } from '../../types';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import { bankStatementsService, ExtractedTransaction, ParseStatementResult } from '../../src/services/bankStatements.service';
import { PdfPasswordRequiredError } from '../../src/utils/bankStatementFile';
import { useUI } from '../../src/context/UIContext';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

const BANK_OPTIONS = [
  { id: '', label: 'Deteksi Otomatis' },
  { id: 'BCA', label: 'BCA' },
  { id: 'MANDIRI', label: 'Mandiri' },
  { id: 'BNI', label: 'BNI' },
];

interface ReviewRow extends ExtractedTransaction {
  included: boolean;
  accountId: string;
}

export const ImportRekeningKoran: React.FC = () => {
  const { toast } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankHint, setBankHint] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [result, setResult] = useState<ParseStatementResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  useEffect(() => {
    accountsService.getAll()
      .then(all => setAccounts(all.filter(a => !a.isHeader)))
      .catch(() => toast('Gagal memuat daftar akun.', 'error'))
      .finally(() => setIsLoadingAccounts(false));
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || !files.length) return;
    setSelectedFile(files[0]);
    setResult(null);
    setRows([]);
    setNeedsPassword(false);
    setPdfPassword('');
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const runParse = async () => {
    if (!selectedFile) return;
    if (!bankAccountId) { toast('Pilih akun Kas/Bank tujuan dulu.', 'warning'); return; }

    setIsParsing(true);
    try {
      const res = await bankStatementsService.parse(selectedFile, bankHint || undefined, pdfPassword || undefined);
      setNeedsPassword(false);
      setResult(res);
      setRows(res.transactions.map(tx => ({
        ...tx,
        included: !tx.needsReview, // baris meragukan default gak dicentang biar user sadar dulu
        accountId: tx.suggestedAccountId || '',
      })));
      toast(`${res.transactions.length} transaksi berhasil diekstrak (${res.bankDetected}).`, 'success');
    } catch (err: any) {
      if (err instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true);
        toast(err.message, 'warning');
      } else {
        toast(err.message || 'Gagal memproses dokumen.', 'error');
      }
    } finally {
      setIsParsing(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const reset = () => {
    setSelectedFile(null);
    setResult(null);
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePosting = async () => {
    const toPost = rows.filter(r => r.included);
    if (!toPost.length) { toast('Tidak ada transaksi yang dicentang untuk diposting.', 'warning'); return; }
    const missingAccount = toPost.find(r => !r.accountId);
    if (missingAccount) { toast('Ada transaksi tercentang yang belum dipilih akun lawannya.', 'warning'); return; }

    const bankAccount = accounts.find(a => a.id === bankAccountId);
    if (!bankAccount) { toast('Akun Kas/Bank tujuan tidak valid.', 'error'); return; }

    setIsPosting(true);
    let success = 0;
    const failed: string[] = [];
    const posted: ReviewRow[] = [];

    for (const row of toPost) {
      const counterAccount = accounts.find(a => a.id === row.accountId);
      if (!counterAccount) { failed.push(row.description); continue; }

      // Statement CR (uang masuk) -> saldo Kas/Bank naik -> baris Kas/Bank didebit, akun lawan dikredit
      // Statement DB (uang keluar) -> saldo Kas/Bank turun -> baris Kas/Bank dikredit, akun lawan didebit
      const bankLine: JournalLine = {
        id: `line-${row.id}-bank`,
        accountId: bankAccount.id,
        accountName: `${bankAccount.code} - ${bankAccount.name}`,
        debit: row.type === 'CR' ? row.amount : 0,
        credit: row.type === 'DB' ? row.amount : 0,
      };
      const counterLine: JournalLine = {
        id: `line-${row.id}-counter`,
        accountId: counterAccount.id,
        accountName: `${counterAccount.code} - ${counterAccount.name}`,
        debit: row.type === 'DB' ? row.amount : 0,
        credit: row.type === 'CR' ? row.amount : 0,
      };

      const payload: Omit<JournalEntry, 'id' | 'createdAt'> = {
        transactionDate: row.date,
        referenceNumber: `BSI-${row.id.slice(0, 8).toUpperCase()}`,
        description: row.description,
        lines: [bankLine, counterLine],
        totalAmount: row.amount,
        status: 'DRAFT',
        createdBy: 'Import Rekening Koran',
      };

      try {
        await journalsService.create(payload);
        success++;
        posted.push(row);
      } catch {
        failed.push(row.description);
      }
    }

    if (posted.length) {
      try {
        await bankStatementsService.reinforceKeywords(
          posted.map(r => ({ accountId: r.accountId, description: r.description }))
        );
      } catch {
        // Kamus gagal diperkuat -> tidak fatal, jurnal tetap sudah tersimpan
      }
    }

    setIsPosting(false);

    if (success > 0) {
      toast(
        `${success} jurnal berhasil dibuat (status DRAFT).${failed.length ? ` ${failed.length} gagal, coba lagi manual.` : ''}`,
        failed.length ? 'warning' : 'success'
      );
      reset();
    } else {
      toast('Semua transaksi gagal diposting.', 'error');
    }
  };

  const includedCount = rows.filter(r => r.included).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Import Rekening Koran</h3>
        <p className="text-sm text-gray-500 mt-1">
          Unggah rekening koran dalam format PDF asli maupun hasil pindai/foto. Sistem akan membaca transaksi secara otomatis dan menyarankan akun COA yang sesuai, seluruhnya diproses secara lokal di server.
        </p>
      </div>

      {!result ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Akun Kas/Bank Tujuan</label>
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                disabled={isLoadingAccounts}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Pilih Akun...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Penerbit (opsional)</label>
              <select
                value={bankHint}
                onChange={e => setBankHint(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {BANK_OPTIONS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File Rekening Koran</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50'
                  : selectedFile
                    ? 'border-emerald-300 bg-gray-50'
                    : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/30'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => handleFileSelect(e.target.files)}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {selectedFile ? (
                <>
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {(selectedFile.size / 1024).toFixed(0)} KB • Klik untuk ganti file
                  </p>
                </>
              ) : (
                <>
                  <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <p className="text-xs text-gray-500">
                    {isDragging ? 'Lepas file di sini' : 'Klik untuk pilih file atau drag & drop'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG (Max 15MB)</p>
                </>
              )}
            </div>
          </div>

          {needsPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password PDF</label>
              <input
                type="password"
                value={pdfPassword}
                onChange={e => setPdfPassword(e.target.value)}
                placeholder="Masukkan password rekening koran"
                autoFocus
                className="w-full px-4 py-2 border border-amber-300 bg-amber-50 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <p className="text-xs text-amber-600 mt-1">
                Dokumen ini terkunci password. Biasanya bank mengirim password lewat SMS/email saat statement diterbitkan.
              </p>
            </div>
          )}

          <button
            onClick={runParse}
            disabled={isParsing || !selectedFile || !bankAccountId}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
          >
            {isParsing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses dokumen...</>
              : <><Landmark className="w-4 h-4" /> Ekstrak Transaksi</>
            }
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Saldo Awal" value={formatCurrency(result.reconciliation.initialBalance)} />
            <SummaryCard label="Total Keluar" value={formatCurrency(result.reconciliation.totalDebit)} tone="red" />
            <SummaryCard label="Total Masuk" value={formatCurrency(result.reconciliation.totalCredit)} tone="emerald" />
            <SummaryCard
              label="Saldo Akhir"
              value={formatCurrency(result.reconciliation.finalBalance)}
              tone={result.reconciliation.isBalanced ? 'emerald' : 'red'}
              badge={result.reconciliation.isBalanced ? 'Reconciled' : 'Selisih Terdeteksi'}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-bold text-gray-900">
                {rows.length} transaksi terdeteksi ({result.bankDetected}) • {includedCount} akan diposting
              </p>
              <button onClick={reset} className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <RefreshCcw className="w-3.5 h-3.5" /> Import Ulang
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-center w-10"></th>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Keterangan</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-left">Akun Lawan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.id} className={row.needsReview ? 'bg-amber-50' : undefined}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={e => updateRow(row.id, { included: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.date || row.rawDate}</td>
                      <td className="px-3 py-2 max-w-xs">
                        <p className="truncate" title={row.description}>{row.description}</p>
                        {row.needsReview && (
                          <p className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> {row.reviewReason || 'Perlu dicek manual'}
                          </p>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${row.type === 'CR' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {row.type === 'CR' ? '+' : '-'}{formatCurrency(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-gray-600">{formatCurrency(row.balance)}</td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <select
                          value={row.accountId}
                          onChange={e => updateRow(row.id, { accountId: e.target.value })}
                          className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary-500 ${
                            row.accountId ? 'border-gray-200' : 'border-amber-300 bg-amber-50'
                          }`}
                        >
                          <option value="">Pilih Akun...</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handlePosting}
            disabled={isPosting || includedCount === 0}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
          >
            {isPosting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Memposting jurnal...</>
              : <><Send className="w-4 h-4" /> Posting {includedCount} Transaksi ke Jurnal (Draft)</>
            }
          </button>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; tone?: 'emerald' | 'red'; badge?: string }> = ({ label, value, tone, badge }) => (
  <div className={`p-4 rounded-xl border ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : tone === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-lg font-bold mt-1 ${tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
    {badge && (
      <div className="flex items-center gap-1 mt-1">
        {tone === 'emerald' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
        <span className={`text-[10px] font-bold uppercase ${tone === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>{badge}</span>
      </div>
    )}
  </div>
);
