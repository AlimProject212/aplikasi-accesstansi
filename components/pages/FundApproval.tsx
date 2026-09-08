
import React, { useState, useEffect } from 'react';
import { FundRequest, HierarchicalAccount, CompanyProfile } from '../../types';
import { CheckCircle, XCircle, Clock, AlertCircle, Save, Printer, Building, X, Loader2 } from 'lucide-react';
import { useUI } from '../../src/context/UIContext';
import { fundRequestsService } from '../../src/services/fundRequests.service';
import { accountsService } from '../../src/services/accounts.service';
import { settingsService } from '../../src/services/settings.service';

export const FundApprovalPage: React.FC = () => {
  const { toast } = useUI();

  const [requests, setRequests]           = useState<FundRequest[]>([]);
  const [accounts, setAccounts]           = useState<HierarchicalAccount[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  const [selectedRequest, setSelectedRequest]   = useState<FundRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<FundRequest | null>(null);
  const [rejectionReason, setRejectionReason]   = useState('');
  const [debitAccount, setDebitAccount]         = useState('');
  const [creditAccount, setCreditAccount]       = useState('');
  const [companyProfile, setCompanyProfile]     = useState<CompanyProfile | null>(null);
  const [printingRequest, setPrintingRequest]   = useState<FundRequest | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [reqs, allAccounts, profile] = await Promise.all([
          fundRequestsService.getAll(),
          accountsService.getAll(),
          settingsService.getProfile().catch(() => null),
        ]);
        setRequests(reqs);
        setAccounts(allAccounts.filter((a: HierarchicalAccount) => !a.isHeader));
        if (profile) setCompanyProfile(profile);
      } catch {
        toast('Gagal memuat data.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  // ─── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = (req: FundRequest) => {
    setSelectedRequest(req);
    setDebitAccount('');
    setCreditAccount('');
  };

  const confirmApproval = async () => {
    if (!selectedRequest || !debitAccount || !creditAccount) {
      toast('Harap pilih akun Debet dan Kredit sebelum menyetujui.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await fundRequestsService.approve(selectedRequest.id, debitAccount, creditAccount);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast('Pengajuan disetujui dan Jurnal Umum telah diposting otomatis.', 'success');
      setSelectedRequest(null);
      setDebitAccount('');
      setCreditAccount('');
    } catch (err: any) {
      toast(err.message || 'Gagal menyetujui pengajuan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Reject ────────────────────────────────────────────────────────────────
  const handleReject = (req: FundRequest) => {
    setRejectingRequest(req);
    setRejectionReason('');
  };

  const confirmRejection = async () => {
    if (!rejectingRequest || !rejectionReason.trim()) {
      toast('Harap isi alasan penolakan.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await fundRequestsService.reject(rejectingRequest.id, rejectionReason);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast('Pengajuan telah ditolak.', 'success');
      setRejectingRequest(null);
      setRejectionReason('');
    } catch (err: any) {
      toast(err.message || 'Gagal menolak pengajuan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING');

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Persetujuan Dana</h1>
        <p className="text-sm text-gray-500">Review dan setujui pengajuan dana dari karyawan.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Pending Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Menunggu Persetujuan</h3>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan / Tanggal</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keperluan</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Jumlah</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                        Tidak ada pengajuan yang menunggu persetujuan.
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{req.employeeName}</p>
                          <p className="text-xs text-gray-500">{req.date}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{req.purpose}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(req.amountRequested)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Menunggu
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleApprove(req)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Setujui">
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleReject(req)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Tolak">
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Riwayat Persetujuan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan / Tanggal</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keperluan</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Jumlah</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Belum ada riwayat persetujuan.</td>
                    </tr>
                  ) : (
                    historyRequests.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{req.employeeName}</p>
                          <p className="text-xs text-gray-500">{req.date}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{req.purpose}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(req.amountRequested)}</p>
                        </td>
                        <td className="px-6 py-4">
                          {req.status === 'REJECTED' ? (
                            <div className="space-y-1">
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3" /> Ditolak
                              </span>
                              {req.rejectionReason && (
                                <p className="text-[10px] text-red-500 italic max-w-[150px] line-clamp-2">Alasan: {req.rejectionReason}</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              {req.status === 'COMPLETED' ? 'Selesai' : 'Disetujui'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setPrintingRequest(req)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Cetak Voucher"
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
        </>
      )}

      {/* ─── Rejection Modal ─────────────────────────────────────────────────── */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-600 text-white">
              <h2 className="text-xl font-bold">Tolak Pengajuan</h2>
              <button onClick={() => setRejectingRequest(null)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <p className="text-sm text-red-800">
                  Anda akan menolak pengajuan dari <span className="font-bold">{rejectingRequest.employeeName}</span> sebesar{' '}
                  <span className="font-bold">{formatCurrency(rejectingRequest.amountRequested)}</span>.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Penolakan</label>
                <textarea
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  placeholder="Berikan alasan mengapa pengajuan ini ditolak..."
                  rows={4}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setRejectingRequest(null)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Batal
                </button>
                <button
                  onClick={confirmRejection}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : 'Tolak Pengajuan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Approval Modal ──────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary-500 text-white">
              <h2 className="text-xl font-bold">Persetujuan &amp; Mapping Akun</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Karyawan</p>
                    <p className="text-sm font-bold">{selectedRequest.employeeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Jumlah</p>
                    <p className="text-sm font-bold text-primary-600">{formatCurrency(selectedRequest.amountRequested)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500 uppercase">Keperluan</p>
                  <p className="text-sm">{selectedRequest.purpose}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Tentukan akun untuk posting jurnal otomatis</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Akun Debet (Uang Muka / Piutang Karyawan)</label>
                  <select value={debitAccount} onChange={e => setDebitAccount(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">Pilih Akun...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Akun Kredit (Kas / Bank)</label>
                  <select value={creditAccount} onChange={e => setCreditAccount(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">Pilih Akun...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setSelectedRequest(null)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Batal
                </button>
                <button
                  onClick={confirmApproval}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                    : <><Save className="w-4 h-4" /> Setujui &amp; Posting</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Print Preview Modal ─────────────────────────────────────────────── */}
      {printingRequest && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto print:block">
          <div className="max-w-[210mm] mx-auto p-12 min-h-screen flex flex-col bg-white">
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
                <h2 className="text-2xl font-bold uppercase text-primary-800 tracking-tight">Voucher Pengeluaran Dana</h2>
                <div className="mt-2 inline-block bg-gray-50 px-3 py-1 rounded border border-gray-200">
                  <span className="font-mono text-lg font-bold text-gray-900">{printingRequest.id}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Tanggal: {formatDateIndo(printingRequest.date)}</p>
              </div>
            </div>

            <div className="flex-1 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Penerima Dana</p>
                  <p className="text-lg font-semibold text-gray-900">{printingRequest.employeeName}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status Persetujuan</p>
                  <p className="text-lg font-bold text-green-700">{printingRequest.status}</p>
                  {printingRequest.approvedAt && (
                    <p className="text-xs text-gray-500">Disetujui pada: {formatDateIndo(printingRequest.approvedAt)}</p>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Keperluan / Deskripsi</p>
                <p className="text-gray-800 text-lg leading-relaxed italic">"{printingRequest.purpose}"</p>
              </div>
              <div className="border-t-2 border-b-2 border-gray-100 py-6 flex justify-between items-center">
                <p className="text-xl font-bold text-gray-900 uppercase">Jumlah Dana Terbayar</p>
                <p className="text-3xl font-bold text-primary-800">{formatCurrency(printingRequest.amountRequested)}</p>
              </div>
              {(printingRequest.debitAccountId || printingRequest.creditAccountId) && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accounting Mapping (Jurnal Otomatis)</p>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500">Akun Debet:</p>
                      <p className="font-mono font-bold">
                        {accounts.find(a => a.id === printingRequest.debitAccountId)?.code || '—'}{' - '}
                        {accounts.find(a => a.id === printingRequest.debitAccountId)?.name || 'Uang Muka Karyawan'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Akun Kredit:</p>
                      <p className="font-mono font-bold">
                        {accounts.find(a => a.id === printingRequest.creditAccountId)?.code || '—'}{' - '}
                        {accounts.find(a => a.id === printingRequest.creditAccountId)?.name || 'Kas / Bank'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-12 grid grid-cols-3 gap-8">
                {['Penerima', 'Kasir / Accountant', 'Mengetahui'].map((label, i) => (
                  <div key={i} className="text-center space-y-16">
                    <p className="text-sm font-bold text-gray-600 uppercase">{label}</p>
                    <div className="border-b border-gray-400 mx-4"></div>
                    <p className="text-xs text-gray-500 font-medium">
                      {i === 0 ? printingRequest.employeeName : i === 1 ? 'Verified' : 'Supervisor'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 italic">
              <p>Dicetak melalui Sistem AccessTansi pada {new Date().toLocaleString('id-ID')}</p>
              <p>Voucher ini adalah bukti pengeluaran dana yang sah.</p>
            </div>
          </div>

          <div className="fixed top-6 right-6 flex gap-3 print:hidden">
            <button onClick={() => window.print()} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-full shadow-lg font-bold flex items-center gap-2">
              <Printer className="w-5 h-5" /> Cetak Voucher
            </button>
            <button onClick={() => setPrintingRequest(null)} className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-full shadow-lg font-bold border border-gray-200 flex items-center gap-2">
              <X className="w-5 h-5" /> Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
