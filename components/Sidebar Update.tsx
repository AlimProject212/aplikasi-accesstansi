
import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  PieChart, 
  Settings, 
  Bot, 
  LogOut,
  List,
  Scale,
  Users,
  Calendar,
  Wallet,
  CheckSquare,
  ClipboardCheck
} from 'lucide-react';
import { PageView } from '../types';

interface SidebarProps {
  activePage: PageView;
  onNavigate: (page: PageView) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, isMobileOpen, setIsMobileOpen }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coa', label: 'Daftar Akun', icon: List },
    { id: 'contacts', label: 'Kontak', icon: Users }, // NEW
    { id: 'opening-balance', label: 'Saldo Awal', icon: Scale },
    { id: 'journal', label: 'Jurnal Umum', icon: FileText },
    { id: 'fund-request', label: 'Pengajuan Dana', icon: Wallet },
    { id: 'fund-approval', label: 'Persetujuan Dana', icon: CheckSquare },
    { id: 'fund-realization', label: 'Realisasi Dana', icon: ClipboardCheck },
    { id: 'reports', label: 'Laporan', icon: PieChart },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

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
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-xl font-bold text-gray-800 tracking-tight">AccessTansi</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id as PageView);
                    setIsMobileOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200
                    ${isActive 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Profile / Footer */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                 <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Senior Accountant</p>
                <p className="text-xs text-gray-500 truncate">admin@accesstansi.com</p>
              </div>
            </div>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
