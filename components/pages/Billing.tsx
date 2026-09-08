import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../src/services/api';

interface Subscription {
  id: number; planTier: 'starter' | 'professional';
  billingCycle: string; status: string;
  startDate: string; endDate: string;
  daysLeft: number; isExpired: boolean; isTrial: boolean;
}
interface Addon {
  id: number; moduleId: number; name: string; slug: string;
  description: string; priceMonthly: number; status: string; endDate: string;
}
interface Module { id: number; name: string; slug: string; description: string; priceMonthly: number; }
interface Prices {
  starter:      { monthly: number; yearly: number };
  professional: { monthly: number; yearly: number };
}
interface BillingStatus {
  subscription: Subscription | null;
  prices: Prices;
  addons: Addon[];
  availableModules: Module[];
}
interface Invoice {
  id: string; type: string; description: string;
  amount: number; status: string; paidAt: string | null; createdAt: string;
}

const env = (import.meta as any).env ?? {};
const DEFAULT_PRICES: Prices = {
  starter:      { monthly: Number(env.VITE_STARTER_MONTHLY) || 79000,  yearly: Number(env.VITE_STARTER_YEARLY)  || 790000  },
  professional: { monthly: Number(env.VITE_PRO_MONTHLY)     || 149000, yearly: Number(env.VITE_PRO_YEARLY)      || 1490000 },
};

const rp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const FEATURES: { label: string; starter: boolean; pro: boolean }[] = [
  { label: 'Jurnal Umum unlimited',   starter: true,  pro: true  },
  { label: 'Chart of Accounts',       starter: true,  pro: true  },
  { label: 'Laporan Keuangan',        starter: true,  pro: true  },
  { label: 'Manajemen Periode',       starter: true,  pro: true  },
  { label: 'Anggaran & Realisasi',    starter: false, pro: true  },
  { label: 'Export Excel & PDF',      starter: false, pro: true  },
  { label: 'Multi User (hingga 10)',  starter: false, pro: true  },
  { label: 'Modul Tambahan (Add-on)', starter: false, pro: true  },
];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
    <circle cx="8" cy="8" r="8" fill="#dcfce7"/>
    <path d="M5 8l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
    <circle cx="8" cy="8" r="8" fill="#f3f4f6"/>
    <path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const Billing: React.FC = () => {
  const [data, setData]         = useState<BillingStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState<string | null>(null);
  const [cycle, setCycle]       = useState<'monthly' | 'yearly'>('monthly');
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const prices = data?.prices ?? DEFAULT_PRICES;

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      showToast('Pembayaran berhasil! Masa aktif diperbarui.');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(load, 2000);
    } else if (payment === 'failed') {
      showToast('Pembayaran dibatalkan atau gagal. Silakan coba lagi.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const load = async () => {
    try {
      const [d, inv] = await Promise.all([apiGet('/billing/status'), apiGet('/billing/invoices')]);
      setData(d); setInvoices(inv);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat data', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const checkout = async (type: 'subscription' | 'addon', planTier?: string, moduleId?: number) => {
    const key = type === 'addon' ? `addon-${moduleId}` : `${planTier}-${cycle}`;
    setPaying(key);
    try {
      const body: any = { type };
      if (type === 'subscription') { body.planTier = planTier; body.billingCycle = cycle; }
      if (type === 'addon')        { body.addonModuleId = moduleId; }
      const res = await apiPost('/billing/checkout', body);
      if (!res.paymentUrl) { showToast('Gagal mendapatkan URL pembayaran.', 'error'); return; }
      window.location.href = res.paymentUrl;
    } catch (e: any) {
      showToast(e.message || 'Gagal membuat transaksi', 'error');
    } finally { setPaying(null); }
  };

  const sub      = data?.subscription;
  const daysLeft = sub?.daysLeft ?? 0;
  const barPct   = Math.min(100, (daysLeft / (sub?.billingCycle === 'yearly' ? 365 : 30)) * 100);
  const barColor = daysLeft > 15 ? '#16a34a' : daysLeft > 5 ? '#d97706' : '#dc2626';
  const isPro    = sub?.planTier === 'professional' && !sub?.isExpired;
  const isStarter= sub?.planTier === 'starter'       && !sub?.isExpired;

  const isAddonActive = (mid: number) => data?.addons.some(a => a.moduleId === mid && a.status === 'active') ?? false;
  const addonEndDate  = (mid: number) => data?.addons.find(a => a.moduleId === mid)?.endDate;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', color: '#9ca3af', fontSize: '14px', gap: '10px' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Memuat data billing...
    </div>
  );

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '8px 0 40px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: toast.type === 'success' ? '#15803d' : '#dc2626',
          padding: '12px 18px', borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,.08)', maxWidth: '360px',
          fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
          Billing &amp; Langganan
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          Kelola paket, perpanjang masa aktif, dan tambah modul sesuai kebutuhan.
        </p>
      </div>

      {/* Status Banner */}
      {sub && (
        <div style={{
          background: sub.isExpired ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${sub.isExpired ? '#fca5a5' : '#86efac'}`,
          borderRadius: '12px', padding: '16px 20px', marginBottom: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: sub.isExpired ? '#fee2e2' : '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sub.isExpired ? '#dc2626' : '#16a34a'} strokeWidth="2">
                {sub.isExpired
                  ? <><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></>
                  : <><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></>
                }
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: 700,
                  color: sub.isExpired ? '#dc2626' : '#15803d',
                }}>
                  {sub.isExpired ? 'Kadaluarsa' : sub.isTrial ? 'Trial Aktif' : 'Aktif'}
                </span>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                  {sub.planTier === 'professional' ? 'Professional' : 'Starter'}
                  {' · '}{sub.billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                Berlaku hingga{' '}
                <strong style={{ color: '#111827' }}>
                  {new Date(sub.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </strong>
                {!sub.isExpired && (
                  <span style={{ color: daysLeft <= 5 ? '#dc2626' : '#6b7280', marginLeft: '8px' }}>
                    ({daysLeft <= 5 ? '⚠️ ' : ''}{daysLeft} hari lagi)
                  </span>
                )}
              </p>
              {!sub.isExpired && (
                <div style={{ marginTop: '8px', background: '#e5e7eb', borderRadius: '4px', height: '5px', width: '200px', maxWidth: '100%' }}>
                  <div style={{ width: `${barPct}%`, background: barColor, height: '100%', borderRadius: '4px', transition: 'width .5s' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Siklus pembayaran:</span>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
          {(['monthly', 'yearly'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: cycle === c ? 600 : 400,
                background: cycle === c ? '#fff' : 'transparent',
                color: cycle === c ? '#111827' : '#6b7280',
                boxShadow: cycle === c ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}
            >
              {c === 'monthly' ? 'Bulanan' : 'Tahunan'}
            </button>
          ))}
        </div>
        {cycle === 'yearly' && (
          <span style={{
            background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac',
            fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
          }}>
            Hemat 2 bulan!
          </span>
        )}
      </div>

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '36px' }}>

        {/* STARTER */}
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '28px 24px',
          border: isStarter ? '2px solid #16a34a' : '1px solid #e5e7eb',
          boxShadow: '0 1px 4px rgba(0,0,0,.06)',
          position: 'relative',
        }}>
          {isStarter && (
            <div style={{
              position: 'absolute', top: '-1px', left: '24px',
              background: '#16a34a', color: '#fff',
              fontSize: '11px', fontWeight: 700, padding: '3px 12px',
              borderRadius: '0 0 8px 8px', letterSpacing: '.04em',
            }}>
              PLAN AKTIF
            </div>
          )}
          <div style={{ marginTop: isStarter ? '16px' : '0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Paket 1</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Starter</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px', minHeight: '36px' }}>
              Cocok untuk usaha kecil &amp; lembaga dengan 1–2 pengguna.
            </p>
            <div style={{ height: '1px', background: '#f3f4f6', margin: '0 0 20px' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
              <span style={{ fontSize: '15px', color: '#d4a843', fontWeight: 700 }}>Rp</span>
              <span style={{ fontSize: '34px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                {(cycle === 'yearly' ? prices.starter.yearly : prices.starter.monthly).toLocaleString('id-ID')}
              </span>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>/{cycle === 'yearly' ? 'thn' : 'bln'}</span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 20px' }}>
              {cycle === 'yearly' ? `Hemat ${rp(prices.starter.monthly * 12 - prices.starter.yearly)}` : 'ditagih setiap bulan'}
            </p>
            <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FEATURES.map(f => (
                <li key={f.label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: f.starter ? '#374151' : '#d1d5db' }}>
                  {f.starter ? <CheckIcon /> : <CrossIcon />}
                  {f.label}
                </li>
              ))}
            </ul>
            {isStarter ? (
              <button
                disabled={!!paying}
                onClick={() => checkout('subscription', 'starter')}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px', border: '1.5px solid #16a34a',
                  background: '#f0fdf4', color: '#15803d', fontWeight: 600, fontSize: '14px',
                  cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? .6 : 1,
                }}
              >
                {paying === `starter-${cycle}` ? 'Memproses...' : '↺ Perpanjang Starter'}
              </button>
            ) : isPro ? (
              <button disabled style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#9ca3af', fontWeight: 600, fontSize: '14px', cursor: 'not-allowed' }}>
                Plan Lebih Rendah
              </button>
            ) : (
              <button
                disabled={!!paying}
                onClick={() => checkout('subscription', 'starter')}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px', border: '1.5px solid #d4a843',
                  background: '#fff', color: '#92400e', fontWeight: 600, fontSize: '14px',
                  cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? .6 : 1,
                }}
              >
                {paying === `starter-${cycle}` ? 'Memproses...' : 'Pilih Starter'}
              </button>
            )}
          </div>
        </div>

        {/* PROFESSIONAL */}
        <div style={{
          background: '#fffbeb', borderRadius: '16px', padding: '28px 24px',
          border: isPro ? '2px solid #16a34a' : '1.5px solid #d4a843',
          boxShadow: '0 4px 20px rgba(212,168,67,.15)',
          position: 'relative',
        }}>
          {isPro ? (
            <div style={{
              position: 'absolute', top: '-1px', left: '24px',
              background: '#16a34a', color: '#fff',
              fontSize: '11px', fontWeight: 700, padding: '3px 12px',
              borderRadius: '0 0 8px 8px', letterSpacing: '.04em',
            }}>
              PLAN AKTIF
            </div>
          ) : (
            <div style={{
              position: 'absolute', top: 0, right: '20px',
              background: 'linear-gradient(135deg,#d4a843,#f0c86a)', color: '#000',
              fontSize: '11px', fontWeight: 700, padding: '4px 14px',
              borderRadius: '0 0 10px 10px', letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
              Terpopuler
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Paket 2</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Professional</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px', minHeight: '36px' }}>
              Untuk lembaga &amp; instansi yang butuh fitur lengkap dan banyak pengguna.
            </p>
            <div style={{ height: '1px', background: '#fde68a', margin: '0 0 20px' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
              <span style={{ fontSize: '15px', color: '#d4a843', fontWeight: 700 }}>Rp</span>
              <span style={{ fontSize: '34px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                {(cycle === 'yearly' ? prices.professional.yearly : prices.professional.monthly).toLocaleString('id-ID')}
              </span>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>/{cycle === 'yearly' ? 'thn' : 'bln'}</span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 20px' }}>
              {cycle === 'yearly' ? `Hemat ${rp(prices.professional.monthly * 12 - prices.professional.yearly)}` : 'ditagih setiap bulan'}
            </p>
            <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FEATURES.map(f => (
                <li key={f.label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: '#374151' }}>
                  <CheckIcon />
                  {f.label}
                </li>
              ))}
            </ul>
            <button
              disabled={!!paying}
              onClick={() => checkout('subscription', 'professional')}
              style={{
                width: '100%', padding: '11px', borderRadius: '10px', border: 'none',
                background: paying ? '#e5e7eb' : 'linear-gradient(135deg,#d4a843,#f0c86a)',
                color: paying ? '#9ca3af' : '#000',
                fontWeight: 700, fontSize: '14px',
                cursor: paying ? 'not-allowed' : 'pointer',
                boxShadow: paying ? 'none' : '0 2px 8px rgba(212,168,67,.4)',
              }}
            >
              {paying === `professional-${cycle}` ? 'Memproses...' : isPro ? '↺ Perpanjang Professional' : '⭐ Pilih Professional'}
            </button>
          </div>
        </div>
      </div>

      {/* Add-on Modules */}
      {isPro && (data?.availableModules?.length ?? 0) > 0 && (
        <div style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Modul Tambahan</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>Add-on opsional — hanya tersedia untuk paket Professional.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '14px' }}>
            {(data?.availableModules || []).map(mod => {
              const active  = isAddonActive(mod.id);
              const endDate = addonEndDate(mod.id);
              return (
                <div key={mod.id} style={{
                  background: '#fff', borderRadius: '12px', padding: '18px 20px',
                  border: `1px solid ${active ? '#86efac' : '#e5e7eb'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{mod.name}</h3>
                    {active && (
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', flexShrink: 0, marginLeft: '8px' }}>
                        Aktif
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>{mod.description}</p>
                  {active && endDate && (
                    <p style={{ fontSize: '12px', color: '#16a34a', margin: '0 0 12px', fontWeight: 500 }}>
                      Aktif hingga {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#d4a843' }}>
                      {rp(mod.priceMonthly)}<span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af' }}>/bln</span>
                    </span>
                    <button
                      onClick={() => checkout('addon', undefined, mod.id)}
                      disabled={!!paying}
                      style={{
                        padding: '7px 14px', borderRadius: '8px', border: 'none',
                        fontSize: '13px', fontWeight: 600,
                        cursor: paying ? 'not-allowed' : 'pointer',
                        background: active ? '#f3f4f6' : '#d4a843',
                        color: active ? '#6b7280' : '#000',
                        opacity: paying ? .6 : 1,
                      }}
                    >
                      {active ? '↺ Perpanjang' : '+ Aktifkan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade hint untuk Starter */}
      {isStarter && (data?.availableModules?.length ?? 0) > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '32px',
          display: 'flex', gap: '12px', alignItems: 'center',
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>⭐</span>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#92400e' }}>
            Upgrade ke <strong>Professional</strong> untuk mengakses modul tambahan seperti Manajemen Dana dan Repository Dokumen.
          </p>
        </div>
      )}

      {/* Invoice History */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Riwayat Pembayaran</h2>
        {invoices.length === 0 ? (
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
            padding: '48px', textAlign: 'center',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Belum ada riwayat pembayaran.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Tanggal', 'Keterangan', 'Jumlah', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', color: '#6b7280',
                      fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(inv.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: '#374151' }}>{inv.description}</td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: '#d4a843', fontWeight: 600, whiteSpace: 'nowrap' }}>{rp(inv.amount)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                        fontSize: '12px', fontWeight: 600,
                        ...(inv.status === 'paid'
                          ? { background: '#dcfce7', color: '#15803d' }
                          : inv.status === 'pending'
                          ? { background: '#fef9c3', color: '#a16207' }
                          : inv.status === 'expired'
                          ? { background: '#f3f4f6', color: '#6b7280' }
                          : { background: '#fee2e2', color: '#dc2626' }),
                      }}>
                        {inv.status === 'paid' ? '✓ Lunas'
                          : inv.status === 'pending' ? '⏳ Menunggu'
                          : inv.status === 'expired' ? '⌛ Kadaluarsa'
                          : '✕ Gagal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
