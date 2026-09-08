import React, { useState } from 'react';
import { AuthUser } from '../../src/context/AuthContext';
import { settingsService, periodsService } from '../../src/services/settings.service';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  user: AuthUser;
  onComplete: () => void;
}

interface ProfileForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  taxId: string;
}

interface PeriodForm {
  year: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const steps = [
  { num: 1, label: 'Profil Perusahaan' },
  { num: 2, label: 'Tahun Buku'        },
  { num: 3, label: 'Selesai'           },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export const OnboardingWizard: React.FC<Props> = ({ user, onComplete }) => {
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [profile, setProfile] = useState<ProfileForm>({
    name:    '',
    address: '',
    city:    '',
    phone:   '',
    email:   user.email,
    taxId:   '',
  });

  const [period, setPeriod] = useState<PeriodForm>({
    year: new Date().getFullYear().toString(),
  });

  // ── Step 1: Simpan profil → lanjut ke step 2 ──────────────────────────────
  const handleProfileNext = async () => {
    if (!profile.name.trim())    { setError('Nama perusahaan wajib diisi.'); return; }
    if (!profile.address.trim()) { setError('Alamat wajib diisi.'); return; }
    if (!profile.city.trim())    { setError('Kota wajib diisi.'); return; }
    setError('');
    setLoading(true);
    try {
      await settingsService.updateProfile({
        name:    profile.name.trim(),
        address: profile.address.trim(),
        city:    profile.city.trim(),
        phone:   profile.phone.trim(),
        email:   profile.email.trim(),
        taxId:   profile.taxId.trim() || undefined,
      });
      setStep(2);
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan profil.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Buat fiscal year → lanjut ke step 3 ───────────────────────────
  const handlePeriodNext = async () => {
    const yr = period.year.trim();
    if (!yr || !/^\d{4}$/.test(yr)) { setError('Masukkan tahun yang valid (contoh: 2026).'); return; }
    setError('');
    setLoading(true);
    try {
      await periodsService.create(yr);
      await periodsService.setActive(yr);
      // Tandai onboarding selesai
      await settingsService.updateConfig({ onboardingCompleted: true } as any);
      setStep(3);
    } catch (e: any) {
      // Jika periode sudah ada, tetap lanjut
      if (e?.message?.includes('already') || e?.message?.includes('sudah')) {
        await periodsService.setActive(yr).catch(() => {});
        await settingsService.updateConfig({ onboardingCompleted: true } as any);
        setStep(3);
      } else {
        setError(e?.message || 'Gagal membuat tahun buku.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPeriod = async () => {
    setLoading(true);
    try {
      await settingsService.updateConfig({ onboardingCompleted: true } as any);
      setStep(3);
    } catch {
      setStep(3); // skip even if error
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <img src="/logo.png" alt="AccessTansi" className="h-8 w-auto object-contain" />
        <span className="font-semibold text-gray-800">AccessTansi</span>
        <span className="text-gray-300 ml-1">—</span>
        <span className="text-sm text-gray-500">Setup Awal</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center mb-8">
              {steps.map((s, i) => (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                      step === s.num
                        ? 'bg-red-700 border-red-700 text-white'
                        : step > s.num
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {step > s.num ? '✓' : s.num}
                    </div>
                    <span className={`text-sm hidden sm:block ${step === s.num ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ── STEP 1: Profil Perusahaan ─────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="mb-6">
                <p className="text-xs font-mono text-red-700 uppercase tracking-widest mb-1">Langkah 1 dari 2</p>
                <h2 className="text-xl font-semibold text-gray-900">Profil Perusahaan</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Informasi ini akan muncul di laporan keuangan dan dokumen resmi perusahaan Anda.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Perusahaan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                    placeholder="PT Maju Bersama"
                    value={profile.name}
                    onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
                    placeholder="Jl. Sudirman No. 1, Jakarta Pusat"
                    value={profile.address}
                    onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kota <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      placeholder="Jakarta"
                      value={profile.city}
                      onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      placeholder="021-xxxxxxx"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Perusahaan</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      placeholder="info@perusahaan.com"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NPWP</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      placeholder="00.000.000.0-000.000"
                      value={profile.taxId}
                      onChange={e => setProfile(p => ({ ...p, taxId: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleProfileNext}
                  disabled={loading}
                  className="px-6 py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Menyimpan…' : 'Lanjut →'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Tahun Buku ────────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="mb-6">
                <p className="text-xs font-mono text-red-700 uppercase tracking-widest mb-1">Langkah 2 dari 2</p>
                <h2 className="text-xl font-semibold text-gray-900">Tahun Buku</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Buat periode akuntansi untuk tahun berjalan. Anda bisa menambah tahun lain nanti di menu Pengaturan.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tahun Fiskal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                    placeholder={new Date().getFullYear().toString()}
                    value={period.year}
                    onChange={e => setPeriod({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Contoh: {new Date().getFullYear()} untuk tahun buku Januari–Desember {new Date().getFullYear()}.
                  </p>
                </div>

                {/* Info card */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">ℹ️ Apa itu Tahun Buku?</p>
                  <p>Tahun buku adalah periode akuntansi 12 bulan untuk mencatat semua transaksi. Setelah dibuat, periode ini akan menjadi aktif dan Anda dapat mulai mencatat jurnal.</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={handleSkipPeriod}
                  disabled={loading}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  Lewati untuk sekarang
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep(1); setError(''); }}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    ← Kembali
                  </button>
                  <button
                    onClick={handlePeriodNext}
                    disabled={loading}
                    className="px-6 py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Memproses…' : 'Selesai →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Siap Digunakan!
              </h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Setup awal selesai. AccessTansi siap membantu Anda mengelola keuangan bisnis.<br />
                Mulai dengan mengatur <strong>Chart of Accounts</strong> atau langsung catat jurnal.
              </p>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                {[
                  { icon: '🗂️', label: 'Atur Chart of Accounts', desc: 'Struktur akun keuangan', page: 'coa' },
                  { icon: '✍️', label: 'Catat Jurnal Pertama',    desc: 'Input transaksi harian',   page: 'journal' },
                  { icon: '📊', label: 'Lihat Dashboard',         desc: 'Ringkasan keuangan',        page: 'dashboard' },
                  { icon: '⚙️', label: 'Pengaturan',              desc: 'Logo, penandatangan, dll',  page: 'settings' },
                ].map(item => (
                  <button
                    key={item.page}
                    onClick={onComplete}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors text-left group"
                  >
                    <span className="text-xl mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-red-700">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={onComplete}
                className="w-full py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 transition-colors"
              >
                Mulai Gunakan AccessTansi →
              </button>

              <p className="text-xs text-gray-400 mt-3">
                Halo, <strong>{user.name}</strong>! Selamat datang di AccessTansi. 👋
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
