
import React, { useState, useEffect } from 'react';
import { FundRequest, CompanyProfile } from '../../types';
import { Plus, Wallet, Clock, CheckCircle, XCircle, Send, Printer, RefreshCcw, AlertCircle, Loader2 } from 'lucide-react';
import { useUI } from '../../src/context/UIContext';
import { useAuth } from '../../src/context/AuthContext';
import { fundRequestsService } from '../../src/services/fundRequests.service';
import { settingsService } from '../../src/services/settings.service';
import { FundRequestPrintForm } from '../shared/FundRequestPrintForm';

export const FundRequestPage: React.FC = () => {
  const { toast } = useUI();
  const { user } = useAuth();

  const [requests, setRequests]       = useState<FundRequest[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [purpose, setPurpose]         = useState('');
  const [amount, setAmount]           = useState('');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [printingRequest, setPrintingRequest] = useState<FundRequest | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fundRequestsService.getAll()
      .then(setRequests)
      .catch(() => toast('Gagal memuat data pengajuan dana.', 'error'))
      .finally(() => setIsLoading(false));

    settingsService.getProfile()
      .then(setCompanyProfile)
      .catch(() => {});
  }, []);

  // ─── Submit new request ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast('Silakan login terlebih dahulu.', 'error'); return; }

    setIsSubmitting(true);
    try {
      const newReq = await fundRequestsService.create({
        employeeId:      String(user.id),
        employeeName:    user.name,
        employeeRole:    user.role,
        date:            new Date().toISOString().split('T')[0],
        purpose,
        amountRequested: Number(amount),
      });
      setRequests(prev => [newReq, ...prev]);
      toast('Pengajuan dana berhasil dikirim.', 'success');
      setIsModalOpen(false);
      setPurpose('');
      setAmount('');
      setPrintingRequest(newReq);
    } catch (err: any) {
      toast(err.message || 'Gagal mengirim pengajuan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Resubmit (pre-fill modal) ────────────────────────────────────────────
  const handleResubmit = (req: FundRequest) => {
    setPurpose(req.purpose);
    setAmount(req.amountRequested.toString());
    setIsModalOpen(true);
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

  const getStatusBadge = (req: FundRequest) => {
    switch (req.status) {
      case 'PENDING':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Menunggu</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Disetujui</span>;
      case 'REJECTED':
        return (
          <div className="flex flex-col gap-1">
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Ditolak</span>
            {req.rejectionReason && (
              <div className="flex items-start gap-1 text-[10px] text-red-500 italic max-w-[150px]">
                <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{req.rejectionReason}</span>
              </div>
            )}
          </div>
        );
      case 'REALIZED':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1"><Send className="w-3 h-3" /> Direalisasi</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Selesai</span>;
      default: return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengajuan Dana</h1>
          <p className="text-sm text-gray-500">Ajukan dana untuk keperluan operasional kantor.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Buat Pengajuan
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pengajuan</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{requests.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Menunggu Persetujuan</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{requests.filter(r => r.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Dana Disetujui</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(
              requests
                .filter(r => ['APPROVED', 'REALIZED', 'COMPLETED'].includes(r.status))
                .reduce((s, r) => s + r.amountRequested, 0)
            )}
          </p>
        </div>
      </div>

      {/* Request Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada pengajuan dana.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const steps = [
              { key: 'PENDING',   label: 'Menunggu' },
              { key: 'APPROVED',  label: 'Disetujui' },
              { key: 'REALIZED',  label: 'Direalisasi' },
              { key: 'COMPLETED', label: 'Selesai' },
            ];
            const isRejected = req.status === 'REJECTED';
            const currentStep = isRejected ? -1 : steps.findIndex(s => s.key === req.status);

            const cardBorder = isRejected
              ? 'border-red-200 bg-red-50/30'
              : req.status === 'COMPLETED'
              ? 'border-gray-200 bg-gray-50/30'
              : 'border-gray-200 bg-white';

            return (
              <div key={req.id} className={`rounded-xl border shadow-sm overflow-hidden ${cardBorder}`}>
                {/* Card Header */}
                <div className="flex items-start justify-between px-5 pt-4 pb-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-400 mb-0.5">{req.id} · {formatDateIndo(req.date)}</p>
                    <p className="text-base font-semibold text-gray-800 leading-snug">{req.purpose}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(req.amountRequested)}</p>
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full mt-1">
                        <XCircle className="w-3 h-3" /> Ditolak
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Steps */}
                {!isRejected ? (
                  <div className="px-5 pb-4">
                    <div className="flex items-center gap-0">
                      {steps.map((step, i) => {
                        const done = i <= currentStep;
                        const active = i === currentStep;
                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                                ${done
                                  ? active
                                    ? 'bg-primary-500 text-white ring-2 ring-primary-200'
                                    : 'bg-primary-500 text-white'
                                  : 'bg-gray-200 text-gray-400'
                                }`}
                              >
                                {done && !active ? '✓' : i + 1}
                              </div>
                              <span className={`text-[10px] mt-1 font-medium ${done ? 'text-primary-600' : 'text-gray-400'}`}>
                                {step.label}
                              </span>
                            </div>
                            {i < steps.length - 1 && (
                              <div className={`flex-1 h-0.5 mb-4 mx-1 rounded ${i < currentStep ? 'bg-primary-400' : 'bg-gray-200'}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  req.rejectionReason && (
                    <div className="mx-5 mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-700"><span className="font-semibold">Alasan penolakan:</span> {req.rejectionReason}</p>
                    </div>
                  )
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 px-5 py-2.5 border-t border-gray-100/80 bg-gray-50/50">
                  <button
                    onClick={() => setPrintingRequest(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Formulir
                  </button>
                  {req.status === 'REJECTED' && (
                    <button
                      onClick={() => handleResubmit(req)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Ajukan Ulang
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Buat Pengajuan Dana</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan / Deskripsi</label>
                <textarea
                  required
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="Contoh: Pembelian ATK Bulanan"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Dana (IDR)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="0"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printingRequest && (
        <FundRequestPrintForm
          request={printingRequest}
          companyProfile={companyProfile}
          onClose={() => setPrintingRequest(null)}
        />
      )}
    </div>
  );
};
