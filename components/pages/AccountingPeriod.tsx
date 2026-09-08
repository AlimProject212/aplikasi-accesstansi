
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { periodsService } from '../../src/services/settings.service';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const AccountingPeriod: React.FC = () => {
  // State (same shape as before for UI compatibility)
  const [periods, setPeriods] = useState<string[]>([]);
  const [activePeriod, setActivePeriodState] = useState<string>('');
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);

  // UI State
  const [newYear, setNewYear] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from API on mount
  useEffect(() => {
    periodsService.getAll()
      .then(data => {
        const years = data.map(p => p.year).sort((a, b) => parseInt(b) - parseInt(a));
        setPeriods(years);
        const active = data.find(p => p.isActive);
        if (active) setActivePeriodState(active.year);
        const locked = data.flatMap(p => p.lockedMonths.map(m => m.yearMonth));
        setLockedMonths(locked);
      })
      .catch(() => addToast('Gagal memuat periode', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const handleAddYear = async () => {
    if (!newYear || newYear.length !== 4 || isNaN(parseInt(newYear))) {
      addToast('Tahun harus 4 digit angka', 'error'); return;
    }
    if (periods.includes(newYear)) {
      addToast('Tahun sudah ada', 'error'); return;
    }
    try {
      await periodsService.create(newYear);
      setPeriods(prev => [...prev, newYear].sort((a, b) => parseInt(b) - parseInt(a)));
      setNewYear('');
      addToast(`Tahun ${newYear} berhasil ditambahkan`);
    } catch (err: any) {
      addToast(err.message || 'Gagal menambah tahun', 'error');
    }
  };

  const handleDeleteYear = async (year: string) => {
    if (year === activePeriod) {
      addToast('Tidak dapat menghapus tahun yang sedang aktif', 'error');
      setShowDeleteConfirm(null); return;
    }
    try {
      await periodsService.delete(year);
      setPeriods(prev => prev.filter(p => p !== year));
      setLockedMonths(prev => prev.filter(m => !m.startsWith(year)));
      addToast(`Tahun ${year} berhasil dihapus`, 'info');
      setShowDeleteConfirm(null);
    } catch (err: any) {
      addToast(err.message || 'Gagal menghapus tahun', 'error');
    }
  };

  const handleSetActive = async (year: string) => {
    try {
      await periodsService.setActive(year);
      setActivePeriodState(year);
      addToast(`Tahun ${year} diset sebagai periode aktif`);
    } catch (err: any) {
      addToast(err.message || 'Gagal mengatur periode aktif', 'error');
    }
  };

  const toggleMonthLock = async (year: string, monthIndex: number) => {
    const monthStr = (monthIndex + 1).toString().padStart(2, '0');
    const key = `${year}-${monthStr}`;
    try {
      if (lockedMonths.includes(key)) {
        await periodsService.unlockMonth(year, key);
        setLockedMonths(prev => prev.filter(m => m !== key));
        addToast(`Bulan ${getMonthName(monthIndex)} ${year} dibuka`, 'info');
      } else {
        await periodsService.lockMonth(year, key);
        setLockedMonths(prev => [...prev, key]);
        addToast(`Bulan ${getMonthName(monthIndex)} ${year} dikunci`, 'success');
      }
    } catch (err: any) {
      addToast(err.message || 'Gagal mengubah status bulan', 'error');
    }
  };

  const getMonthName = (index: number) => {
    return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][index];
  };

  const getLockedCount = (year: string) => lockedMonths.filter(m => m.startsWith(year)).length;

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat periode...</div>;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Manajemen Periode</h1>
          <p className="text-gray-500 mt-1">Kelola tahun buku dan kontrol penguncian transaksi bulanan.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
          <input
            type="text"
            placeholder="Tambah Tahun (YYYY)"
            className="px-4 py-2 text-sm border-none focus:ring-0 w-40"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyPress={(e) => e.key === 'Enter' && handleAddYear()}
          />
          <button onClick={handleAddYear} className="bg-primary-500 hover:bg-primary-600 text-white p-2 rounded-xl transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Internal Control Policy Block */}
      <div className="bg-amber-50 border border-amber-200 rounded-[32px] p-6 flex gap-4 items-start">
        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><AlertTriangle className="w-6 h-6" /></div>
        <div>
          <h3 className="text-amber-900 font-bold text-lg">Internal Control Policy</h3>
          <p className="text-amber-800/80 text-sm mt-1 leading-relaxed">
            Bulan yang telah <strong>Dikunci (Locked)</strong> akan secara otomatis mematikan fitur tambah, edit, dan hapus pada seluruh modul transaksi. Pastikan semua rekonsiliasi selesai sebelum mengunci periode.
          </p>
        </div>
      </div>

      {/* Periods Grid */}
      <div className="grid grid-cols-1 gap-8">
        {periods.map(year => {
          const isActive = year === activePeriod;
          const lockedCount = getLockedCount(year);
          const isFullLocked = lockedCount === 12;

          return (
            <div key={year} className={`bg-white rounded-[32px] border transition-all duration-300 overflow-hidden ${isActive ? 'border-primary-500 ring-4 ring-primary-50 shadow-2xl scale-[1.01]' : 'border-gray-200 shadow-sm hover:shadow-md'}`}>
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900">Tahun Buku {year}</h2>
                      {isActive && <span className="bg-primary-100 text-primary-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Aktif</span>}
                      {isFullLocked && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Terproteksi</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{lockedCount} dari 12 bulan terkunci</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!isActive && (
                    <button onClick={() => handleSetActive(year)} className="text-sm font-semibold text-primary-600 hover:text-primary-700 px-4 py-2 rounded-xl hover:bg-primary-50 transition-colors">
                      Set Aktif
                    </button>
                  )}
                  {showDeleteConfirm === year ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDeleteYear(year)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700">Ya, Hapus</button>
                      <button onClick={() => setShowDeleteConfirm(null)} className="text-gray-500 text-sm font-medium px-3 py-2">Batal</button>
                    </div>
                  ) : (
                    !isActive && (
                      <button onClick={() => setShowDeleteConfirm(year)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Months Grid */}
              <div className="p-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const monthStr = (i + 1).toString().padStart(2, '0');
                    const isLocked = lockedMonths.includes(`${year}-${monthStr}`);
                    return (
                      <button key={i} onClick={() => toggleMonthLock(year, i)} className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 ${isLocked ? 'bg-red-50 border-red-200 text-red-700 shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50/30'}`}>
                        <div className={`mb-2 p-2 rounded-xl transition-colors ${isLocked ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-400 group-hover:bg-primary-100 group-hover:text-primary-500'}`}>
                          {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                        </div>
                        <span className="text-sm font-bold">{getMonthName(i)}</span>
                        <span className="text-[10px] uppercase tracking-widest mt-1 opacity-60">{isLocked ? 'Locked' : 'Open'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <Info className="w-5 h-5 text-primary-500" />
          <h3 className="font-bold text-gray-900">Ringkasan Integritas Periode</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Tahun Buku</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Bulan Terkunci</th>
                <th className="px-6 py-4 font-bold">Integritas</th>
                <th className="px-6 py-4 font-bold">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map(year => {
                const isActive = year === activePeriod;
                const lockedCount = getLockedCount(year);
                const isFullLocked = lockedCount === 12;
                return (
                  <tr key={year} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{year}</td>
                    <td className="px-6 py-4">
                      {isActive
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">Aktif</span>
                        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Arsip</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[100px] overflow-hidden">
                          <div className={`h-full rounded-full ${isFullLocked ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${(lockedCount / 12) * 100}%` }} />
                        </div>
                        <span className="text-sm text-gray-600 font-medium">{lockedCount}/12</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isFullLocked
                        ? <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm"><ShieldCheck className="w-4 h-4" /> Verified</div>
                        : <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm"><AlertTriangle className="w-4 h-4" /> Open</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {isActive ? 'Tahun berjalan untuk input data' : 'Tahun lampau untuk pelaporan'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-right duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
