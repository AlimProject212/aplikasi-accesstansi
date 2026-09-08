import React, { useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { LogIn, AlertCircle, Eye, EyeOff, Mail, Lock, Building2, BookOpen } from 'lucide-react';

const FEATURES = [
  'Jurnal Umum & Buku Besar',
  'Laporan Keuangan Lengkap',
  'Multi-User & Hak Akses',
  'AI Financial Assistant',
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  const handleCompanyCode = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase dan auto-insert dash setelah 4 karakter
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Format XXXX-XXXX: pastikan dash di posisi 4 jika belum ada
    if (val.length === 5 && !val.includes('-')) {
      val = val.slice(0, 4) + '-' + val.slice(4);
    }
    setCompanyCode(val.slice(0, 9));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyCode.trim()) {
      setError('Company ID wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      await login(companyCode.trim(), email, password);
    } catch (err: any) {
      setError(err.message || 'Company ID, email, atau password salah.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Left Brand Panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 p-12">

        {/* Decorative rings */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border border-white/10" />
          <div className="absolute top-1/4 -right-32 w-80 h-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full border border-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
        </div>

        {/* Glowing blob */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
              <img src="/logo.png" alt="AccessTansi" className="h-16 w-16 object-contain drop-shadow-xl" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">AccessTansi</h1>
          <p className="text-primary-300 text-base mb-10">Sistem Akuntansi Terpadu</p>

          <div className="space-y-3 text-left max-w-xs mx-auto">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-primary-100">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2">
            <BookOpen className="w-3.5 h-3.5 text-primary-300" />
            <span className="text-xs text-primary-200 font-medium">Kelola keuangan bisnis dengan mudah</span>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ─────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">

          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/logo.png" alt="AccessTansi" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">AccessTansi</h1>
              <p className="text-xs text-gray-400 mt-0.5">Sistem Akuntansi</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Selamat Datang 👋</h2>
              <p className="text-sm text-gray-500">Masuk ke dasbor keuangan Anda</p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Company ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Company ID
                  <span className="ml-2 text-xs font-normal text-gray-400">— diterima saat daftar</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={companyCode}
                    onChange={handleCompanyCode}
                    required
                    autoFocus
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-widest bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white transition-all placeholder-gray-300 uppercase"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alamat Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 text-white font-semibold rounded-xl text-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-200 active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Masuk
                  </>
                )}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Belum punya akun?{' '}
                <a
                  href="https://accesstansi.id/daftar.html"
                  className="font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                >
                  Daftar Gratis →
                </a>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            © {new Date().getFullYear()} AccessTansi · Sistem Akuntansi Terpadu
          </p>
        </div>
      </div>

    </div>
  );
};
