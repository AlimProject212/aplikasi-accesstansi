
import React from 'react';
import {
  LayoutDashboard,
  FileText,
  PieChart,
  Settings,
  Bot,
  LogOut,
  List,
  CreditCard,
} from 'lucide-react';
import { PageView } from '../types';
import { AuthUser } from '../src/context/AuthContext';
import { ADDON_NAV_GROUPS, ADDON_NAV_ITEMS, AddonNavItem } from './addonNavItems';

interface SidebarProps {
  activePage: PageView;
  onNavigate: (page: PageView) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  user?: AuthUser;
  onLogout?: () => void;
  activeAddonId?: string | null;
  onNavigateToAddon: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, isMobileOpen, setIsMobileOpen, user, onLogout, activeAddonId, onNavigateToAddon }) => {
  const role = user?.role;
  const isKaryawan   = role === 'KARYAWAN';
  const isViewer     = role === 'VIEWER';
  const isAdminAbove = role === 'SUPERADMIN' || role === 'ADMIN';
  const canJournal   = isAdminAbove || role === 'SUPERVISOR' || role === 'ACCOUNTANT';
  const canReport    = canJournal || role === 'VIEWER';
  const canInventory = !isViewer && (isAdminAbove || role === 'SUPERVISOR' || role === 'ACCOUNTANT');
  // Kasir (biasanya KARYAWAN) cuma butuh akses ke POS, bukan seluruh modul dagang.
  const canPOSOnly   = !canInventory && !isViewer && !!user?.canOperatePOS;

  // ── Item core (selalu di atas) ──
  const coreMenuItems = [
    { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, show: !isKaryawan },
    { id: 'coa',          label: 'Daftar Akun',  icon: List,            show: isAdminAbove },
    { id: 'journal',      label: 'Jurnal Umum',  icon: FileText,        show: canJournal },
    { id: 'reports',      label: 'Laporan',      icon: PieChart,        show: canReport },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot,             show: isAdminAbove },
  ].filter(item => item.show);

  // ── Item bawah (Pengaturan & Billing) ──
  const bottomMenuItems = [
    { id: 'settings', label: 'Pengaturan', icon: Settings,   show: isAdminAbove || isKaryawan },
    { id: 'billing',  label: 'Billing',    icon: CreditCard, show: isAdminAbove },
  ].filter(item => item.show);

  // ── Grup modul add-on (di antara core & bawah, dipisah garis + label) ──
  const visibleForGroup = (groupId: string): AddonNavItem[] => {
    const items = ADDON_NAV_ITEMS.filter(i => i.group === groupId);
    switch (groupId) {
      case 'fund':
        if (isViewer) return [];
        return items.filter(i => i.id !== 'fund-approval' || !isKaryawan);
      case 'docs':
        return (isKaryawan || isViewer) ? [] : items;
      case 'trading':
        if (canInventory) return items;
        if (canPOSOnly)   return items.filter(i => i.id === 'pos');
        return [];
      default:
        return [];
    }
  };

  const addonGroups = ADDON_NAV_GROUPS
    .map(group => ({ group, items: visibleForGroup(group.id) }))
    .filter(g => g.items.length > 0);

  const goToAddon = (id: string) => {
    onNavigateToAddon(id);
    setIsMobileOpen(false);
  };

  const navButtonClass = (isActive: boolean) => `
    w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200
    ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
  `;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="flex items-center justify-center h-16 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AccessTansi" className="h-8 w-auto object-contain" />
              <span className="text-xl font-bold text-gray-800 tracking-tight">AccessTansi</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {/* Core */}
            {coreMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id as PageView); setIsMobileOpen(false); }}
                  className={navButtonClass(isActive)}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              );
            })}

            {/* Modul add-on — tiap modul dipisah garis + label kecil, item langsung
                di luar (bukan sub-menu), dibuka full-page di area utama. */}
            {addonGroups.map(({ group, items }) => (
              <div key={group.id} className="pt-3 mt-3 border-t border-gray-100">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{group.label}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === 'addon' && activeAddonId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => goToAddon(item.id)}
                      className={navButtonClass(isActive)}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Pengaturan & Billing */}
            {bottomMenuItems.length > 0 && (
              <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
                {bottomMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id as PageView); setIsMobileOpen(false); }}
                      className={navButtonClass(isActive)}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* User Profile / Footer */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() ?? 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name ?? 'Administrator'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
