
import React, { useState, useEffect } from 'react';
import { FundRequest, HierarchicalAccount, CompanyProfile } from '../../types';
import { ClipboardCheck, Search, Plus, Save, XCircle, AlertCircle, CheckCircle, FileText, Printer, Building, X, Trash2, Loader2 } from 'lucide-react';
import { useUI } from '../../src/context/UIContext';
import { fundRequestsService } from '../../src/services/fundRequests.service';
import { accountsService } from '../../src/services/accounts.service';
import { settingsService } from '../../src/services/settings.service';


export const FundRealizationPage: React.FC = () => {
  const { toast } = useUI();
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [printingRequest, setPrintingRequest] = useState<FundRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Realization Form State
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseLines, setExpenseLines] = useState<{ accountId: string; amount: number }[]>([{ accountId: '', amount: 0 }]);
  const [refundAccountId, setRefundAccountId] = useState('');

  useEffect(() => {
    // Load all data from API in parallel
    Promise.all([
      fundRequestsService.getAll(),
      accountsService.getAll(),
      settingsService.getProfile(),
    ]).then(([reqData, coaData, profile]) => {
      setRequests(reqData);
      setAccounts(coaData.filter((a: HierarchicalAccount) => !a.isHeader));
      setCompanyProfile(profile);
    }).catch(err => toast(err.message || 'Gagal memuat data realisasi.', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleRealize = (req: FundRequest) => {
    setSelectedRequest(req);
    setActualAmount(req.amountRequested.toString());
    setExpenseLines([{ accountId: '', amount: req.amountRequested }]);
    setRefundAccountId(req.creditAccountId || ''); // Default to original cash account
  };

  const addExpenseLine = () => {
    setExpenseLines([...expenseLines, { accountId: '', amount: 0 }]);
  };

  const removeExpenseLine = (index: number) => {
    if (expenseLines.length > 1) {
      setExpenseLines(expenseLines.filter((_, i) => i !== index));
    }
  };

  const updateExpenseLine = (index: number, field: 'accountId' | 'amount', value: string | number) => {
    const updated = [...expenseLines];
    updated[index] = { ...updated[index], [field]: value };
    setExpenseLines(updated);
  };

  const totalAllocated = expenseLines.reduce((sum, line) => sum + Number(line.amount), 0);

  const confirmRealization = async () => {
    if (!selectedRequest || !actualAmount) {
      toast("Harap isi jumlah aktual.", 'warning');
      return;
    }

    if (expenseLines.some(line => !line.accountId || line.amount <= 0)) {
      toast("Harap lengkapi semua baris akun biaya dan jumlahnya.", 'warning');
      return;
    }

    const diff = selectedRequest.amountRequested - totalAllocated;

    // Validate refund account if there's a difference
    if (diff > 0 && !refundAccountId) {
      toast("Harap pilih akun untuk pengembalian sisa dana.", 'warning');
      return;
    }
    if (diff < 0 && !refundAccountId) {
      toast("Harap pilih akun untuk pembayaran selisih dana (reimbursement).", 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await fundRequestsService.realize(selectedRequest.id, {
        actualAmount: Number(actualAmount),
        expenseLines: expenseLines.map(l => ({ accountId: l.accountId, amount: Number(l.amount) })),
        refundAccountId: refundAccountId || undefined,
        notes: notes || undefined,
      });

      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedRequest(null);
      setActualAmount('');
      setNotes('');
      setExpenseLines([{ accountId: '', amount: 0 }]);
      setRefundAccountId('');
      toast("Realisasi berhasil diposting ke Jurnal Umum.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal memposting realisasi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Realisasi Dana</h1>
        <p className="text-sm text-gray-500">Laporkan penggunaan dana dan posting ke akun biaya.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Menunggu Realisasi
            {!isLoading && requests.filter(r => r.status === 'APPROVED').length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                {requests.filter(r => r.status === 'APPROVED').length}
              </span>
            )}
          </h3>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID / Karyawan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keperluan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Dana Diberikan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" />
                  </td>
                </tr>
              ) : requests.filter(r => r.status === 'APPROVED').length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Tidak ada dana yang perlu direalisasikan saat ini.</td>
                </tr>
              ) : (
                requests.filter(r => r.status === 'APPROVED').map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{req.id}</p>
                      <p className="text-xs text-gray-500">{req.employeeName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{req.purpose}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(req.amountRequested)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Cair</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleRealize(req)}
                        className="px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        Input Realisasi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realization History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Riwayat Realisasi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID / Karyawan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keperluan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Dana Realisasi</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" />
                  </td>
                </tr>
              ) : requests.filter(r => r.status === 'COMPLETED').length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Belum ada riwayat realisasi.</td>
                </tr>
              ) : (
                requests.filter(r => r.status === 'COMPLETED').map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{req.id}</p>
                      <p className="text-xs text-gray-500">{req.employeeName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{req.purpose}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(req.realization?.actualAmount || 0)}
                      </p>
                      <p className="text-[10px] text-gray-400">Awal: {formatCurrency(req.amountRequested)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Selesai</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setPrintingRequest(req)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Cetak Laporan Realisasi"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realization Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary-600 text-white">
              <h2 className="text-xl font-bold">Laporan Realisasi Dana</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-bold">Informasi Dana Awal</p>
                  <p>Dana sebesar <span className="font-bold">{formatCurrency(selectedRequest.amountRequested)}</span> telah diberikan untuk <span className="italic">"{selectedRequest.purpose}"</span>.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Aktual Digunakan (IDR)</label>
                  <input
                    type="number"
                    required
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-bold text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {totalAllocated < selectedRequest.amountRequested ? 'Akun Pengembalian Sisa' : 'Akun Pembayaran Selisih'}
                  </label>
                  <select
                    value={refundAccountId}
                    onChange={(e) => setRefundAccountId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Pilih Akun Kas/Bank...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Account Expense Allocation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Alokasi Akun Biaya</label>
                  <button
                    type="button"
                    onClick={addExpenseLine}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {expenseLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                      <div className="flex-1">
                        <select
                          value={line.accountId}
                          onChange={(e) => updateExpenseLine(index, 'accountId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">Pilih Akun Biaya...</option>
                          {accounts.filter(a => a.type === 'EXPENSE').map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          value={line.amount}
                          onChange={(e) => updateExpenseLine(index, 'amount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-right"
                          placeholder="0"
                        />
                      </div>
                      <button
                        onClick={() => removeExpenseLine(index)}
                        disabled={expenseLines.length === 1}
                        className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm font-medium text-gray-500">Total Alokasi:</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary-600">
                      {formatCurrency(totalAllocated)}
                    </p>
                    {totalAllocated !== Number(actualAmount) && (
                      <p className="text-[10px] text-blue-500 italic">
                        Selisih {formatCurrency(Math.abs(totalAllocated - Number(actualAmount)))} akan otomatis dialokasikan ke {refundAccountId ? accounts.find(a => a.id === refundAccountId)?.name : 'akun kas/bank'}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan / Keterangan Tambahan</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  rows={2}
                  placeholder="Contoh: Sisa dana dikembalikan ke kas kecil."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setSelectedRequest(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmRealization}
                  disabled={isSubmitting || (!refundAccountId && totalAllocated !== selectedRequest.amountRequested)}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memposting...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Posting Realisasi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printingRequest && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto print:block">
          <div className="max-w-[210mm] mx-auto p-12 min-h-screen flex flex-col bg-white">
            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-primary-800 pb-6 mb-8">
              <div className="flex items-start gap-4">
                {companyProfile?.logoUrl ? (
                  <img src={companyProfile.logoUrl} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border border-gray-200">
                    <Building className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">{companyProfile?.name || 'ACCESSTANSI CORP'}</h1>
                  <p className="text-sm text-gray-600 mt-1 max-w-[300px] leading-snug">
                    {companyProfile ? `${companyProfile.address}${companyProfile.city ? ', ' + companyProfile.city : ''}` : 'Alamat Perusahaan Belum Diatur'}
                  </p>
                  {(companyProfile?.phone || companyProfile?.email) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {companyProfile.phone && `Tel: ${companyProfile.phone}`}
                      {companyProfile.phone && companyProfile.email && ' | '}
                      {companyProfile.email && `Email: ${companyProfile.email}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold uppercase text-primary-800 tracking-tight">Laporan Pertanggungjawaban Dana</h2>
                <div className="mt-2 inline-block bg-gray-50 px-3 py-1 rounded border border-gray-200">
                  <span className="font-mono text-lg font-bold text-gray-900">{printingRequest.realization?.id || 'REAL-PENDING'}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Ref Pengajuan: {printingRequest.id}</p>
              </div>
            </div>

            {/* Print Body */}
            <div className="flex-1 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Karyawan Pelapor</p>
                  <p className="text-lg font-semibold text-gray-900">{printingRequest.employeeName}</p>
                  <p className="text-sm text-gray-500">Tanggal Realisasi: {formatDateIndo(printingRequest.realization?.date || '')}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status Penyelesaian</p>
                  <p className="text-lg font-bold text-blue-700">COMPLETED</p>
                  <p className="text-xs text-gray-500 italic">Jurnal Settlement Terposting</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Deskripsi Penggunaan & Catatan</p>
                <p className="text-gray-900 font-medium mb-2">{printingRequest.purpose}</p>
                <p className="text-gray-600 text-sm italic">"{printingRequest.realization?.notes || 'Tidak ada catatan tambahan.'}"</p>
              </div>

              {/* Expense Breakdown */}
              {printingRequest.realization?.expenseLines && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2 font-bold text-gray-500 uppercase text-[10px]">Alokasi Akun Biaya</th>
                        <th className="px-4 py-2 font-bold text-gray-500 uppercase text-[10px] text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {printingRequest.realization.expenseLines.map((line, idx) => {
                        const acc = accounts.find(a => a.id === line.accountId);
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-gray-700">{acc ? `${acc.code} - ${acc.name}` : line.accountId}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(line.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Dana Diterima</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(printingRequest.amountRequested)}</p>
                </div>
                <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
                  <p className="text-[10px] font-bold text-primary-400 uppercase mb-1">Realisasi (Aktual)</p>
                  <p className="text-lg font-bold text-primary-800">{formatCurrency(printingRequest.realization?.actualAmount || 0)}</p>
                </div>
                <div className={`p-4 rounded-lg border ${ (printingRequest.amountRequested - (printingRequest.realization?.actualAmount || 0)) >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100' }`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Selisih (Refund/Kurang)</p>
                  <p className={`text-lg font-bold ${ (printingRequest.amountRequested - (printingRequest.realization?.actualAmount || 0)) >= 0 ? 'text-green-700' : 'text-red-700' }`}>
                    {formatCurrency(printingRequest.amountRequested - (printingRequest.realization?.actualAmount || 0))}
                  </p>
                </div>
              </div>

              {/* Signature Section */}
              <div className="mt-12 grid grid-cols-3 gap-8">
                <div className="text-center space-y-16">
                  <p className="text-sm font-bold text-gray-600 uppercase">Pelapor</p>
                  <div className="border-b border-gray-400 mx-4"></div>
                  <p className="text-xs text-gray-500 font-medium">{printingRequest.employeeName}</p>
                </div>
                <div className="text-center space-y-16">
                  <p className="text-sm font-bold text-gray-600 uppercase">Pemeriksa (Finance)</p>
                  <div className="border-b border-gray-400 mx-4"></div>
                  <p className="text-xs text-gray-500 font-medium">Verified</p>
                </div>
                <div className="text-center space-y-16">
                  <p className="text-sm font-bold text-gray-600 uppercase">Mengetahui</p>
                  <div className="border-b border-gray-400 mx-4"></div>
                  <p className="text-xs text-gray-500 font-medium">Supervisor</p>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 italic">
              <p>Dicetak melalui Sistem AccessTansi pada {new Date().toLocaleString('id-ID')}</p>
              <p>Laporan ini merupakan bukti pertanggungjawaban penggunaan dana perusahaan.</p>
            </div>
          </div>

          {/* Print Controls (Hidden on Print) */}
          <div className="fixed top-6 right-6 flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-full shadow-lg font-bold flex items-center gap-2 transition-all transform hover:scale-105"
            >
              <Printer className="w-5 h-5" />
              Cetak Laporan
            </button>
            <button
              onClick={() => setPrintingRequest(null)}
              className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-full shadow-lg font-bold border border-gray-200 flex items-center gap-2 transition-all"
            >
              <X className="w-5 h-5" />
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
