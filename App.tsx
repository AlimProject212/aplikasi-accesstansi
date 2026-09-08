import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/pages/Login';
import { OnboardingWizard } from './components/pages/OnboardingWizard';
import { PageView } from './types';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UIProvider } from './src/context/UIContext';
import { settingsService } from './src/services/settings.service';
import { apiGet } from './src/services/api';

interface BillingStatusMini {
  subscription: { daysLeft: number; isExpired: boolean; status: string; isTrial: boolean } | null;
  addons?: { moduleId: number; slug: string; status: string }[];
}

function pathnameToPage(pathname: string): PageView {
  const map: Record<string, PageView> = {
    '/billing':      'billing',
    '/settings':     'settings',
    '/coa':          'coa',
    '/journal':      'journal',
    '/reports':      'reports',
    '/ai-assistant': 'ai-assistant',
  };
  return map[pathname] ?? 'dashboard';
}

const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [activePage, setActivePage] = useState<PageView>(() => pathnameToPage(window.location.pathname));
  const [activeAddonId, setActiveAddonId] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatusMini | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [expiredMsg, setExpiredMsg] = useState('');

  // Cek onboarding setelah user login
  useEffect(() => {
    if (!user) { setOnboardingChecked(false); setShowOnboarding(false); setBillingStatus(null); return; }
    settingsService.getConfig()
      .then(cfg => {
        setShowOnboarding(cfg.onboardingCompleted === false);
        setOnboardingChecked(true);
      })
      .catch(() => setOnboardingChecked(true)); // fallback: skip wizard jika error

    // Cek status billing untuk banner peringatan
    apiGet('/billing/status')
      .then((s: any) => setBillingStatus(s))
      .catch(() => {}); // silent — billing banner opsional
  }, [user]);

  // Dengarkan event 402 dari API calls manapun
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setExpiredMsg(detail?.error || 'Langganan tidak aktif.');
      setSubscriptionExpired(true);
    };
    window.addEventListener('subscription-expired', handler);
    return () => window.removeEventListener('subscription-expired', handler);
  }, []);

  if (isLoading || (user && !onboardingChecked)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Memuat...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const inventoryAddonActive = billingStatus?.addons?.some(
    a => a.slug === 'persediaan-dagang' && a.status === 'active'
  ) ?? false;

  // Tampilkan wizard setup untuk perusahaan baru
  if (showOnboarding) {
    return (
      <OnboardingWizard
        user={user}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">

      {/* Sidebar Component */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        user={user}
        onLogout={logout}
        activeAddonId={activePage === 'addon' ? activeAddonId : null}
        onNavigateToAddon={(id) => { setActiveAddonId(id); setActivePage('addon'); }}
      />

      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-2 mr-2 rounded-md hover:bg-gray-100 text-gray-600"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AccessTansi" className="h-8 w-auto object-contain" />
          <span className="font-bold text-gray-800">AccessTansi</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-0 pt-16 lg:pt-0">

        {/* ── Banner: trial aktif (> 3 hari) ── */}
        {billingStatus?.subscription?.isTrial && !billingStatus.subscription.isExpired && billingStatus.subscription.daysLeft > 3 && (
          <div style={{ background: '#1e3a5f', color: '#93c5fd', padding: '10px 20px', textAlign: 'center', fontSize: '14px' }}>
            Masa trial aktif —{' '}
            <strong>{billingStatus.subscription.daysLeft} hari</strong> tersisa.{' '}
            <button
              onClick={() => setActivePage('billing')}
              style={{ color: '#fbbf24', marginLeft: '8px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
            >
              Upgrade sekarang
            </button>
          </div>
        )}

        {/* ── Banner: trial hampir habis (≤ 3 hari) ── */}
        {billingStatus?.subscription?.isTrial && !billingStatus.subscription.isExpired && billingStatus.subscription.daysLeft <= 3 && (
          <div style={{ background: '#78350f', color: '#fcd34d', padding: '10px 20px', textAlign: 'center', fontSize: '14px' }}>
            ⚠️ Trial hampir habis!{' '}
            <strong>{billingStatus.subscription.daysLeft} hari</strong> lagi.{' '}
            <button
              onClick={() => setActivePage('billing')}
              style={{ color: '#fff', marginLeft: '8px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
            >
              Upgrade sekarang
            </button>
          </div>
        )}

        {/* ── Banner: langganan berbayar hampir expired (≤ 5 hari, bukan trial) ── */}
        {billingStatus?.subscription && !billingStatus.subscription.isTrial && billingStatus.subscription.daysLeft <= 5 && !billingStatus.subscription.isExpired && (
          <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 20px', textAlign: 'center', fontSize: '14px' }}>
            Langganan akan berakhir dalam{' '}
            <strong>{billingStatus.subscription.daysLeft} hari</strong>.{' '}
            <button
              onClick={() => setActivePage('billing')}
              style={{ color: '#fbbf24', marginLeft: '8px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
            >
              Perpanjang sekarang
            </button>
          </div>
        )}

        {/* ── Overlay: subscription expired (dari 402) ── */}
        {subscriptionExpired && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              background: '#1e293b', border: '1px solid #ef4444',
              borderRadius: '16px', padding: '40px 36px', maxWidth: '440px', width: '100%',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
              <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>
                Akses Terbatas
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>
                {expiredMsg}
              </p>
              <button
                onClick={() => { setSubscriptionExpired(false); setActivePage('billing'); }}
                style={{
                  background: 'linear-gradient(135deg,#d4a843,#f0c86a)',
                  color: '#000', border: 'none', borderRadius: '10px',
                  padding: '12px 32px', fontWeight: 700, fontSize: '15px',
                  cursor: 'pointer', width: '100%',
                }}
              >
                Ke Halaman Billing
              </button>
            </div>
          </div>
        )}

        <Dashboard activePage={activePage} user={user} inventoryAddonActive={inventoryAddonActive} onNavigate={setActivePage} activeAddonId={activeAddonId} />
      </div>

    </div>
  );
};

const App: React.FC = () => (
  <UIProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </UIProvider>
);

export default App;