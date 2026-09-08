import React from 'react';
import { FundRequest, CompanyProfile } from '../../types';
import { Printer, X, Building } from 'lucide-react';
import { terbilangRupiah } from '../../src/utils/terbilang';

interface FundRequestPrintFormProps {
  request: FundRequest;
  companyProfile: CompanyProfile | null;
  onClose: () => void;
}

const formatRupiah = (v: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);

const formatDateIndo = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

/** Formulir cetak "Permohonan Uang Muka" — dipakai di halaman Pengajuan & Persetujuan Dana. */
export const FundRequestPrintForm: React.FC<FundRequestPrintFormProps> = ({ request, companyProfile, onClose }) => {
  const signatories: { label: string; name: string }[] = [
    { label: 'Pemohon', name: request.employeeName },
    { label: 'Atasan Pemohon', name: '' },
    { label: 'Disetujui oleh', name: request.status !== 'PENDING' && request.status !== 'REJECTED' ? (request.approvedBy || '') : '' },
    { label: 'Dibayarkan oleh', name: '' },
    { label: 'Diterima', name: request.status === 'REALIZED' || request.status === 'COMPLETED' ? request.employeeName : '' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-500/60 overflow-auto print:bg-white print:block">
      <div className="max-w-[210mm] mx-auto my-8 print:my-0 bg-white shadow-2xl print:shadow-none rounded-sm print:rounded-none overflow-hidden">
        <div className="p-10 md:p-14 min-h-[290mm] flex flex-col">

          {/* Letterhead */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b-[3px] border-gray-800">
            <div className="flex items-center gap-4">
              {companyProfile?.logoUrl ? (
                <img src={companyProfile.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border border-gray-300">
                  <Building className="w-7 h-7" />
                </div>
              )}
              <div>
                <h1 className="text-[22px] leading-tight font-extrabold uppercase tracking-wide text-gray-900">
                  {companyProfile?.name || 'Nama Institusi Belum Diatur'}
                </h1>
                {companyProfile?.address && (
                  <p className="text-xs text-gray-600 mt-1 max-w-[380px] leading-snug">
                    {companyProfile.address}{companyProfile.city ? `, ${companyProfile.city}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="text-sm shrink-0 pt-1 space-y-2">
              <div className="flex items-center justify-end gap-2">
                <span className="text-gray-500">Nomor</span>
                <span className="font-mono font-semibold text-gray-900 border-b border-gray-400 min-w-[130px] text-center pb-0.5">
                  {request.id}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-gray-500">Tanggal</span>
                <span className="font-semibold text-gray-900 border-b border-gray-400 min-w-[130px] text-center pb-0.5">
                  {formatDateIndo(request.date)}
                </span>
              </div>
            </div>
          </div>

          <h2 className="text-center text-xl font-bold uppercase tracking-[0.15em] underline underline-offset-[6px] my-9">
            Permohonan Uang Muka
          </h2>

          {/* Fields */}
          <div className="space-y-5 text-[15px] text-gray-900">
            <div className="flex gap-10">
              <div className="flex-[3] flex items-baseline gap-3">
                <span className="text-gray-500 w-[110px] shrink-0">Nama Pemohon</span>
                <span>:</span>
                <span className="flex-1 font-semibold border-b border-dotted border-gray-400 pb-0.5">{request.employeeName}</span>
              </div>
              <div className="flex-[2] flex items-baseline gap-3">
                <span className="text-gray-500 shrink-0">Jabatan</span>
                <span>:</span>
                <span className="flex-1 font-semibold border-b border-dotted border-gray-400 pb-0.5">{request.employeeRole || '-'}</span>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 w-[110px] shrink-0">Keperluan</span>
              <span>:</span>
              <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">{request.purpose}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-500 w-[110px] shrink-0">Jumlah</span>
              <span>:</span>
              <span className="text-gray-700">Rp</span>
              <span className="font-bold text-lg border-2 border-gray-700 rounded px-4 py-1 tabular-nums">
                {formatRupiah(request.amountRequested)}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 w-[110px] shrink-0">Terbilang</span>
              <span>:</span>
              <span className="flex-1 italic border-b border-dotted border-gray-400 pb-0.5">
                {terbilangRupiah(request.amountRequested)}
              </span>
            </div>
          </div>

          {/* Signature table */}
          <div className="mt-auto pt-14">
            <div className="grid grid-cols-5 border border-gray-800 text-center text-xs">
              {signatories.map((s, i) => (
                <div key={s.label} className={`flex flex-col ${i > 0 ? 'border-l border-gray-800' : ''}`}>
                  <div className="font-bold uppercase px-2 py-2 border-b border-gray-800 bg-gray-50">{s.label}</div>
                  <div className="h-24 flex items-end justify-center px-2 pb-2">
                    <span className="font-medium text-gray-700">{s.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-4 flex justify-between items-center text-[10px] text-gray-400 italic print:block">
            <p>Dicetak melalui Sistem AccessTansi pada {new Date().toLocaleString('id-ID')}</p>
            <p>Dokumen ini adalah bukti sah pengajuan dana internal.</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed top-6 right-6 flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-full shadow-lg font-bold flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <Printer className="w-5 h-5" /> Cetak / Simpan PDF
        </button>
        <button
          onClick={onClose}
          className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-full shadow-lg font-bold border border-gray-200 flex items-center gap-2 transition-all"
        >
          <X className="w-5 h-5" /> Tutup Preview
        </button>
      </div>
    </div>
  );
};
