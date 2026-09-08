
import React from 'react';
import { PageView } from '../types';
import { ChartOfAccount } from './pages/ChartOfAccount';
import { GeneralJournal } from './pages/GeneralJournal';
import { Reports } from './pages/Reports';
import { DashboardHome } from './pages/DashboardHome';
import { AiAssistant } from './pages/AiAssistant';
import { Settings } from './pages/Settings';
import { Billing } from './pages/Billing';
import { ADDON_NAV_ITEMS } from './addonNavItems';
import { AuthUser } from '../src/context/AuthContext';
import { Package } from 'lucide-react';

interface DashboardProps {
  activePage: PageView;
  user?: AuthUser | null;
  inventoryAddonActive?: boolean;
  onNavigate?: (page: PageView) => void;
  activeAddonId?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ activePage, user, inventoryAddonActive, activeAddonId }) => {

  // Header Component
  const Header = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );

  // Content Renderer
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardHome />;

      case 'coa':
        return <ChartOfAccount />;

      case 'journal':
        return <GeneralJournal />;

      case 'reports':
        return <Reports user={user} />;

      case 'ai-assistant':
        return <AiAssistant />;

      case 'settings':
        return <Settings user={user} />;

      case 'billing':
        return <Billing />;

      case 'addon': {
        const item = ADDON_NAV_ITEMS.find(i => i.id === activeAddonId);
        if (!item) {
          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex items-center justify-center">
              <p className="text-gray-400">Item tidak ditemukan.</p>
            </div>
          );
        }
        if (item.group === 'trading' && !inventoryAddonActive) {
          return (
            <>
              <Header title={item.label} />
              <div className="bg-white rounded-xl border border-dashed border-gray-200 shadow-sm p-10 flex flex-col items-center justify-center text-center gap-3">
                <Package className="w-10 h-10 text-gray-300" />
                <p className="text-gray-500 max-w-sm">Modul Persediaan &amp; Dagang belum aktif untuk perusahaan Anda. Aktifkan add-on ini lewat halaman Billing untuk mulai mengelola barang, pembelian, penjualan, dan POS.</p>
              </div>
            </>
          );
        }
        const Component = item.component;
        return <Component />;
      }

      default:
        return (
          <>
            <Header title={activePage.charAt(0).toUpperCase() + activePage.slice(1)} />
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex items-center justify-center">
              <p className="text-gray-400">Halaman {activePage} sedang dalam pengembangan.</p>
            </div>
          </>
        );
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {renderContent()}
      </div>
    </main>
  );
};
