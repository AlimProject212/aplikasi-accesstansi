
import React, { useState, useEffect, useRef } from 'react';
import { HierarchicalAccount, AccountType, CashFlowCategory, CompanyProfile, AppConfig, UserRole, RolePermissions, AccountBudget } from '../../types';
import {
  Info, Save, RefreshCw, Building, Calendar, Database, Users,
  Wallet, Upload, Download, Trash2, CheckCircle, AlertTriangle, Image, Shield, Edit2, X, Plus, Target, Lock,
  Key, Eye, EyeOff, Copy, ToggleLeft, ToggleRight, Sparkles, ShieldCheck, Scale, UserRound,
  CheckSquare, ClipboardCheck, Landmark
} from 'lucide-react';
import { AccountingPeriod } from './AccountingPeriod';
import { Contacts } from './Contacts';
import { OpeningBalance } from './OpeningBalance';
import { ImportRekeningKoran } from './ImportRekeningKoran';
import { accountsService } from '../../src/services/accounts.service';
import { settingsService, budgetsService, usersService, apiKeysService, ApiKeyConfig } from '../../src/services/settings.service';
import { useUI } from '../../src/context/UIContext';
import { AuthUser } from '../../src/context/AuthContext';

type SettingsTab = 'CONTACTS' | 'OPENING_BALANCE' | 'BANK_IMPORT' | 'CASH_FLOW' | 'PROFILE' | 'PERIOD' | 'BUDGET' | 'BACKUP' | 'USERS' | 'API_KEYS';

export const Settings: React.FC<{ user?: AuthUser | null }> = ({ user }) => {
  const isKaryawan    = user?.role === 'KARYAWAN';
  const isViewer      = user?.role === 'VIEWER';
  const isAdminOrAbove = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const isSuperAdmin  = user?.role === 'SUPERADMIN';

  const defaultTab = (): SettingsTab => {
    if (isKaryawan || isViewer) return 'PROFILE';
    return 'CASH_FLOW';
  };
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'CONTACTS':        return <Contacts />;
      case 'OPENING_BALANCE': return <OpeningBalance />;
      case 'BANK_IMPORT': return <ImportRekeningKoran />;
      case 'CASH_FLOW': return <CashFlowSettings />;
      case 'PROFILE': return <EntityProfileSettings />;
      case 'PERIOD': return <AccountingPeriod />;
      case 'BUDGET': return <BudgetSettings />;
      case 'BACKUP': return <BackupSettings />;
      case 'USERS': return <UserSettings />;
      case 'API_KEYS': return <ApiKeySettings />;
      default: return <CashFlowSettings />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-100px)]">
      <div className="w-full lg:w-64 shrink-0 space-y-1">
        <h2 className="text-xl font-bold text-gray-900 mb-4 px-2">Pengaturan</h2>

        {/* ── Profil (semua role) ── */}
        <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Profil</p>
        <NavButton active={activeTab === 'PROFILE'} onClick={() => setActiveTab('PROFILE')} icon={Building} label="Profil Entitas" />

        {/* Modul add-on (Manajemen Dana, Repository Dokumen, Persediaan & Dagang)
            sekarang tampil langsung di Sidebar utama — lihat components/addonNavItems.ts */}

        {/* ── Berikut hanya untuk non-KARYAWAN & non-VIEWER ── */}
        {!isKaryawan && !isViewer && (
          <>
            {/* ── Data Master ── */}
            <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Data Master</p>
            <NavButton active={activeTab === 'CONTACTS'}        onClick={() => setActiveTab('CONTACTS')}        icon={UserRound}   label="Kontak" />
            <NavButton active={activeTab === 'OPENING_BALANCE'} onClick={() => setActiveTab('OPENING_BALANCE')} icon={Scale}       label="Saldo Awal" />
            <NavButton active={activeTab === 'BANK_IMPORT'}     onClick={() => setActiveTab('BANK_IMPORT')}     icon={Landmark}    label="Import Rekening Koran" />

            {/* ── Konfigurasi ── */}
            <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Konfigurasi</p>
            <NavButton active={activeTab === 'CASH_FLOW'} onClick={() => setActiveTab('CASH_FLOW')} icon={Wallet} label="Akun Arus Kas" />
            <NavButton active={activeTab === 'PERIOD'} onClick={() => setActiveTab('PERIOD')} icon={Calendar} label="Manajemen Periode" />
            <NavButton active={activeTab === 'BUDGET'} onClick={() => setActiveTab('BUDGET')} icon={Target} label="Anggaran (Budget)" />
            <NavButton active={activeTab === 'BACKUP'} onClick={() => setActiveTab('BACKUP')} icon={Database} label="Backup & Restore" />

            {/* ── Administrasi: API Keys untuk Admin+, Kelola User hanya SUPERADMIN ── */}
            {isAdminOrAbove && (
              <>
                <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Administrasi</p>
                <NavButton active={activeTab === 'API_KEYS'} onClick={() => setActiveTab('API_KEYS')} icon={Key} label="API Keys" />
              </>
            )}
            {isSuperAdmin && (
              <NavButton active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} icon={Users} label="Pengguna & Akses" />
            )}
          </>
        )}
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8">
        {renderContent()}
      </div>
    </div>
  );
};

// ==================================================================================
// SUB-FEATURE 7: API KEY CONFIGURATION
// ==================================================================================
const SERVICE_PRESETS = [
  'Google Gemini',
  'Midtrans', 'Xendit',
  'Mailgun', 'SendGrid',
  'Fonnte', 'WA Gateway',
  'eFaktur / DJP',
  'Custom',
];

const ApiKeySettings: React.FC = () => {
  const { toast, confirm } = useUI();
  const [keys, setKeys] = useState<ApiKeyConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showFormValue, setShowFormValue] = useState(false);

  const [form, setForm] = useState({
    serviceName: '',
    keyName: '',
    keyValue: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    apiKeysService.getAll()
      .then(setKeys)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const openModal = (key?: ApiKeyConfig, prefill?: Partial<typeof form>) => {
    if (key) {
      setEditingKey(key);
      setForm({ serviceName: key.serviceName, keyName: key.keyName, keyValue: '', description: key.description || '', isActive: key.isActive });
    } else {
      setEditingKey(null);
      setForm({ serviceName: prefill?.serviceName || '', keyName: prefill?.keyName || '', keyValue: '', description: prefill?.description || '', isActive: true });
    }
    setShowFormValue(false);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingKey(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceName || !form.keyName) { toast('Service dan Key Name wajib diisi.', 'warning'); return; }
    if (!editingKey && !form.keyValue) { toast('Key Value wajib diisi untuk entry baru.', 'warning'); return; }
    setIsSaving(true);
    try {
      if (editingKey) {
        const payload: any = { serviceName: form.serviceName, keyName: form.keyName, description: form.description, isActive: form.isActive };
        if (form.keyValue) payload.keyValue = form.keyValue;
        const updated = await apiKeysService.update(editingKey.id, payload);
        setKeys(prev => prev.map(k => k.id === editingKey.id ? updated : k));
        // Clear reveal cache for this key if value was changed
        if (form.keyValue) {
          setRevealedIds(prev => { const s = new Set(prev); s.delete(editingKey.id); return s; });
          setRevealedValues(prev => { const n = { ...prev }; delete n[editingKey.id]; return n; });
        }
      } else {
        const created = await apiKeysService.create({ serviceName: form.serviceName, keyName: form.keyName, keyValue: form.keyValue, description: form.description, isActive: form.isActive });
        setKeys(prev => [...prev, created]);
      }
      closeModal();
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan API key', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!await confirm(`Hapus API Key "${name}"? Tindakan ini tidak dapat dibatalkan.`, { title: 'Hapus API Key', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await apiKeysService.delete(id);
      setKeys(prev => prev.filter(k => k.id !== id));
      setRevealedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus', 'error');
    }
  };

  const handleReveal = async (key: ApiKeyConfig) => {
    if (revealedIds.has(key.id)) {
      // Hide
      setRevealedIds(prev => { const s = new Set(prev); s.delete(key.id); return s; });
      return;
    }
    try {
      const { keyValue } = await apiKeysService.reveal(key.id);
      setRevealedValues(prev => ({ ...prev, [key.id]: keyValue }));
      setRevealedIds(prev => new Set(prev).add(key.id));
    } catch (err: any) {
      toast('Gagal mengambil nilai key', 'error');
    }
  };

  const handleToggleActive = async (key: ApiKeyConfig) => {
    try {
      const updated = await apiKeysService.update(key.id, { isActive: !key.isActive });
      setKeys(prev => prev.map(k => k.id === key.id ? updated : k));
    } catch (err: any) {
      toast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  const handleCopy = (id: number, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Group keys by service name
  const grouped = keys.reduce<Record<string, ApiKeyConfig[]>>((acc, k) => {
    if (!acc[k.serviceName]) acc[k.serviceName] = [];
    acc[k.serviceName].push(k);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Konfigurasi API Keys</h3>
          <p className="text-sm text-gray-500">Simpan API key untuk integrasi layanan eksternal (payment gateway, email, pajak, dsb).</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah API Key
        </button>
      </div>

      {/* Gemini Quick Setup Card */}
      {!keys.some(k => k.serviceName === 'Google Gemini' && k.keyName === 'API_KEY') && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">Aktifkan AI Assistant</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Tambahkan Google Gemini API key untuk mengaktifkan fitur AI Assistant analisis keuangan.
            </p>
          </div>
          <button
            onClick={() => openModal(undefined, { serviceName: 'Google Gemini', keyName: 'API_KEY', description: 'AI Assistant' })}
            className="shrink-0 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold"
          >
            + Setup Gemini
          </button>
        </div>
      )}

      {/* Security note */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Keamanan:</strong> API key disimpan di database server dan hanya bisa diakses oleh pengguna yang login. Nilai key ditampilkan dalam bentuk tersembunyi — klik ikon mata untuk melihat nilai asli.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Belum ada API key</p>
          <p className="text-sm text-gray-400 mt-1">Klik "Tambah API Key" untuk mulai menambahkan konfigurasi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([service, serviceKeys]) => (
            <div key={service} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Service header */}
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center">
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="font-semibold text-gray-800 text-sm">{service}</span>
                <span className="ml-auto text-xs text-gray-400">{serviceKeys.length} key</span>
              </div>
              {/* Keys table */}
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-48">Key Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Value</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-48">Keterangan</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 w-20">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {serviceKeys.map(key => {
                    const isRevealed = revealedIds.has(key.id);
                    const displayValue = isRevealed ? (revealedValues[key.id] ?? key.keyValue) : key.keyValue;
                    return (
                      <tr key={key.id} className={`hover:bg-gray-50/50 ${!key.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {key.keyName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-600 truncate max-w-xs">
                              {displayValue}
                            </span>
                            {isRevealed && (
                              <button
                                onClick={() => handleCopy(key.id, displayValue)}
                                title="Copy ke clipboard"
                                className="text-gray-300 hover:text-emerald-500 transition shrink-0"
                              >
                                {copiedId === key.id
                                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                  : <Copy className="w-3.5 h-3.5" />
                                }
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{key.description || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleToggleActive(key)} title={key.isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                            {key.isActive
                              ? <ToggleRight className="w-6 h-6 text-emerald-500 mx-auto" />
                              : <ToggleLeft className="w-6 h-6 text-gray-300 mx-auto" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleReveal(key)}
                              title={isRevealed ? 'Sembunyikan' : 'Tampilkan nilai'}
                              className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
                            >
                              {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openModal(key)}
                              title="Edit"
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(key.id, `${key.serviceName} / ${key.keyName}`)}
                              title="Hapus"
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-gray-900">{editingKey ? 'Edit API Key' : 'Tambah API Key Baru'}</h3>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Layanan <span className="text-red-500">*</span></label>
                  <input
                    list="service-presets"
                    required
                    type="text"
                    value={form.serviceName}
                    onChange={e => setForm({ ...form, serviceName: e.target.value })}
                    placeholder="cth: Midtrans, Xendit..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="service-presets">
                    {SERVICE_PRESETS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Key Name <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    value={form.keyName}
                    onChange={e => setForm({ ...form, keyName: e.target.value })}
                    placeholder="cth: CLIENT_KEY, API_SECRET..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Key Value {editingKey && <span className="text-gray-400 font-normal">(kosongkan jika tidak ingin ganti)</span>}
                  {!editingKey && <span className="text-red-500"> *</span>}
                </label>
                <div className="relative">
                  <input
                    type={showFormValue ? 'text' : 'password'}
                    value={form.keyValue}
                    onChange={e => setForm({ ...form, keyValue: e.target.value })}
                    placeholder={editingKey ? '(tidak berubah jika dikosongkan)' : 'Tempel API key di sini...'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormValue(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showFormValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="cth: Production key, Sandbox key..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  {form.isActive
                    ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                    : <ToggleLeft className="w-6 h-6 text-gray-300" />
                  }
                  {form.isActive ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 text-sm">
                  Batal
                </button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 disabled:opacity-60 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${active ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
    <Icon className={`w-5 h-5 ${active ? 'text-emerald-500' : 'text-gray-400'}`} />
    {label}
  </button>
);

// ==================================================================================
// SUB-FEATURE 1: AKUN ARUS KAS
// ==================================================================================
const CashFlowSettings: React.FC = () => {
  const { toast, confirm } = useUI();
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    accountsService.getAll()
      .then(all => setAccounts(all.filter(a => a.level === 4)))
      .catch(console.error);
  }, []);

  const formatAccountCode = (code: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
  };

  const getTypeLabel = (type: AccountType) => {
    const map: Record<AccountType, string> = {
      [AccountType.ASSET]: 'Aset', [AccountType.LIABILITY]: 'Kewajiban',
      [AccountType.EQUITY]: 'Ekuitas', [AccountType.REVENUE]: 'Pendapatan', [AccountType.EXPENSE]: 'Beban',
    };
    return map[type] || type;
  };

  const handleCategoryChange = (id: string, newCategory: CashFlowCategory) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, cashFlowCategory: newCategory } : a));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await accountsService.updateCashFlow(
        accounts.map(a => ({ id: a.id, cashFlowCategory: a.cashFlowCategory ?? null }))
      );
      toast("Pemetaan arus kas berhasil disimpan.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const applySmartDefaults = async () => {
    if (!await confirm("Otomatis deteksi kategori berdasarkan kode akun?", { title: 'Deteksi Otomatis', variant: 'default', confirmLabel: 'Ya, Deteksi' })) return;
    const updated = accounts.map(acc => {
      let cat = CashFlowCategory.OPERATING;
      if (acc.code.startsWith('12')) cat = CashFlowCategory.INVESTING;
      else if (acc.code.startsWith('22') || acc.code.startsWith('3')) cat = CashFlowCategory.FINANCING;
      return { ...acc, cashFlowCategory: cat };
    });
    setAccounts(updated);
    try {
      await accountsService.updateCashFlow(updated.map(a => ({ id: a.id, cashFlowCategory: a.cashFlowCategory ?? null })));
      toast("Berhasil mendeteksi kategori standar.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan auto-detect', 'error');
    }
  };

  const detectDefault = (acc: HierarchicalAccount): CashFlowCategory => {
    if (acc.cashFlowCategory) return acc.cashFlowCategory;
    if (acc.code.startsWith('12')) return CashFlowCategory.INVESTING;
    if (acc.code.startsWith('22') || acc.code.startsWith('3')) return CashFlowCategory.FINANCING;
    return CashFlowCategory.OPERATING;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Pemetaan Akun Arus Kas</h3>
          <p className="text-sm text-gray-500">Tentukan kategori arus kas untuk setiap akun Header Level 4.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={applySmartDefaults} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100">
            <RefreshCw className="w-4 h-4" /> Auto-Detect
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 disabled:opacity-60">
            <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Panduan Kategori:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Operasional:</strong> Aset Lancar, Kewajiban Lancar, Laba Rugi.</li>
            <li><strong>Investasi:</strong> Aset Tetap, Aset Lain-lain.</li>
            <li><strong>Pendanaan:</strong> Modal, Utang Jangka Panjang.</li>
          </ul>
        </div>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-32">Nomor Akun</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3 w-32">Golongan</th>
              <th className="px-4 py-3 w-56">Kategori Arus Kas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.sort((a, b) => a.code.localeCompare(b.code)).map(acc => {
              const cat = detectDefault(acc);
              return (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-600">{formatAccountCode(acc.code)}</td>
                  <td className="px-4 py-2 font-medium">{acc.name}</td>
                  <td className="px-4 py-2 text-gray-500">{getTypeLabel(acc.type)}</td>
                  <td className="px-4 py-2">
                    <select
                      value={cat}
                      onChange={e => handleCategoryChange(acc.id, e.target.value as CashFlowCategory)}
                      className={`w-full border rounded px-2 py-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-500 ${cat === CashFlowCategory.INVESTING ? 'bg-orange-50 text-orange-800 border-orange-200' : cat === CashFlowCategory.FINANCING ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      <option value={CashFlowCategory.OPERATING}>Operasional</option>
                      <option value={CashFlowCategory.INVESTING}>Investasi</option>
                      <option value={CashFlowCategory.FINANCING}>Pendanaan</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================================================================================
// SUB-FEATURE 2: PROFIL ENTITAS
// ==================================================================================
const EntityProfileSettings: React.FC = () => {
  const { toast } = useUI();
  const [profile, setProfile] = useState<CompanyProfile>({ name: 'Perusahaan Saya', address: '', city: '', phone: '', email: '', logoUrl: '' });
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsService.getProfile().then(setProfile).catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.updateProfile(profile);
      toast("Profil entitas berhasil disimpan.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan profil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (base64.length > 2000000) { toast("Ukuran file logo terlalu besar. Harap gunakan file < 1MB.", 'warning'); return; }
        setProfile(prev => ({ ...prev, logoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="text-lg font-bold text-gray-900">Profil Entitas</h3>
        <p className="text-sm text-gray-500">Informasi ini akan ditampilkan pada Kop Laporan Keuangan.</p>
      </div>
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Logo Perusahaan</label>
          <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 overflow-hidden relative group">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-gray-400 flex flex-col items-center"><Image className="w-8 h-8 mb-1" /><span className="text-xs">No Logo</span></div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => logoInputRef.current?.click()}>
              <span className="text-white text-xs font-bold flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</span>
            </div>
            <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
          </div>
          {profile.logoUrl && (
            <button onClick={() => setProfile({ ...profile, logoUrl: '' })} className="text-xs text-red-600 mt-2 hover:underline flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Hapus Logo
            </button>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Perusahaan / Entitas</label>
            <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Lengkap</label>
            <textarea rows={3} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-semibold text-gray-700 mb-1">Kota</label><input type="text" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1">NPWP (Opsional)</label><input type="text" value={profile.taxId || ''} onChange={e => setProfile({ ...profile, taxId: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-semibold text-gray-700 mb-1">No. Telepon</label><input type="text" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1">Email</label><input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
      </div>

      {/* Penanda Tangan Laporan */}
      <div className="border-t border-gray-100 pt-5">
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-emerald-600" /> Penanda Tangan Laporan
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">Nama dan jabatan yang tercetak pada bagian bawah setiap laporan keuangan.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Penandatangan</label>
            <input
              type="text"
              value={profile.signerName || ''}
              onChange={e => setProfile({ ...profile, signerName: e.target.value })}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan</label>
            <input
              type="text"
              value={profile.signerTitle || ''}
              onChange={e => setProfile({ ...profile, signerTitle: e.target.value })}
              placeholder="Contoh: Direktur Keuangan"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Preview: <span className="italic text-gray-600">{profile.city || 'Kota'}, [Tanggal Cetak] &nbsp;—&nbsp; {profile.signerName || 'Nama Penandatangan'} ({profile.signerTitle || 'Jabatan'})</span>
        </p>
      </div>

      <div className="pt-2">
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm disabled:opacity-60">
          <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </div>
    </div>
  );
};

// ==================================================================================
// SUB-FEATURE 4: ANGGARAN (BUDGET)
// ==================================================================================
const BudgetSettings: React.FC = () => {
  const { toast } = useUI();
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const currentYear = new Date().getFullYear().toString();

  useEffect(() => {
    Promise.all([
      accountsService.getAll(),
      budgetsService.getAll(currentYear),
    ]).then(([allAccounts, budgetData]) => {
      setAccounts(allAccounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader));
      const map: Record<string, number> = {};
      budgetData.forEach(b => { map[b.accountId] = b.annualAmount; });
      setBudgets(map);
    }).catch(console.error);
  }, []);

  const handleBudgetChange = (id: string, val: string) => {
    const num = Number(val.replace(/\D/g, ''));
    setBudgets(prev => ({ ...prev, [id]: num }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: AccountBudget[] = Object.keys(budgets).map(accountId => ({ accountId, annualAmount: budgets[accountId] }));
      await budgetsService.upsertAll(currentYear, payload);
      toast("Anggaran tahunan berhasil disimpan.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan anggaran', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatAccountCode = (code: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="text-lg font-bold text-gray-900">Anggaran Tahunan (Annual Budget)</h3>
        <p className="text-sm text-gray-500">Tentukan plafon pengeluaran untuk setiap akun beban selama satu tahun.</p>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Kode Akun</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3 text-right">Anggaran Per Tahun (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.sort((a, b) => a.code.localeCompare(b.code)).map(acc => (
              <tr key={acc.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{formatAccountCode(acc.code)}</td>
                <td className="px-4 py-2 font-medium">{acc.name}</td>
                <td className="px-4 py-2 text-right">
                  <input type="text" value={new Intl.NumberFormat('id-ID').format(budgets[acc.id] || 0)} onChange={e => handleBudgetChange(acc.id, e.target.value)} className="w-48 px-3 py-1.5 border border-gray-300 rounded-md text-right font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-4">
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm disabled:opacity-60">
          <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Anggaran'}
        </button>
      </div>
    </div>
  );
};

// ==================================================================================
// SUB-FEATURE 5: BACKUP & RESTORE
// ==================================================================================
const BackupSettings: React.FC = () => {
  const { toast } = useUI();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleBackup = async () => {
    setIsDownloading(true);
    try {
      const data = await settingsService.backup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AccessTansi_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message || 'Gagal mengambil backup', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="text-lg font-bold text-gray-900">Backup & Pemeliharaan Data</h3>
        <p className="text-sm text-gray-500">Simpan data Anda secara berkala sebagai cadangan.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-white hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600"><Download className="w-6 h-6" /></div>
          <h4 className="font-bold text-gray-900 mb-2">Backup Data (Export)</h4>
          <p className="text-sm text-gray-500 mb-6">Unduh seluruh data dari database dalam format file JSON.</p>
          <button onClick={handleBackup} disabled={isDownloading} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60">
            {isDownloading ? 'Mengambil data...' : 'Download Backup'}
          </button>
        </div>
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600"><Lock className="w-6 h-6" /></div>
          <h4 className="font-bold text-gray-900 mb-2">Restore Data (Import)</h4>
          <p className="text-sm text-gray-500 mb-4">Untuk restore data dari file backup, gunakan migration script di server:</p>
          <code className="block bg-gray-800 text-green-400 text-xs p-3 rounded-lg leading-relaxed">
            cd backend<br />
            npm run db:seed -- \<br />
            &nbsp; --from-backup=./backup.json
          </code>
        </div>
      </div>
    </div>
  );
};

// ==================================================================================
// SUB-FEATURE 6: MANAJEMEN PENGGUNA
// ==================================================================================
interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  linkedAccountId?: string | null;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageCOA: boolean;
  canEntryJournal: boolean;
  canApproveJournal: boolean;
  canDeleteJournal: boolean;
  canViewReports: boolean;
}

const UserSettings: React.FC = () => {
  const { toast, confirm } = useUI();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [allAccounts, setAllAccounts] = useState<HierarchicalAccount[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');

  const [userForm, setUserForm] = useState<{
    name: string; email: string; password: string; role: UserRole; isActive: boolean; linkedAccountId: string;
  }>({ name: '', email: '', password: '', role: UserRole.ACCOUNTANT, isActive: true, linkedAccountId: '' });

  const defaultPermissions: Record<UserRole, RolePermissions> = {
    [UserRole.SUPERADMIN]: { canManageUsers: true, canManageSettings: true, canManageCOA: true, canEntryJournal: true, canApproveJournal: true, canDeleteJournal: true, canViewReports: true, canManageInventory: true, canManagePurchasing: true, canManageSales: true, canOperatePOS: true, canVoidPOSTransaction: true },
    [UserRole.ADMIN]: { canManageUsers: false, canManageSettings: true, canManageCOA: true, canEntryJournal: true, canApproveJournal: true, canDeleteJournal: true, canViewReports: true, canManageInventory: true, canManagePurchasing: true, canManageSales: true, canOperatePOS: true, canVoidPOSTransaction: true },
    [UserRole.SUPERVISOR]: { canManageUsers: false, canManageSettings: false, canManageCOA: false, canEntryJournal: true, canApproveJournal: true, canDeleteJournal: false, canViewReports: true, canManageInventory: true, canManagePurchasing: true, canManageSales: true, canOperatePOS: true, canVoidPOSTransaction: true },
    [UserRole.ACCOUNTANT]: { canManageUsers: false, canManageSettings: false, canManageCOA: false, canEntryJournal: true, canApproveJournal: false, canDeleteJournal: false, canViewReports: true, canManageInventory: true, canManagePurchasing: true, canManageSales: true, canOperatePOS: false, canVoidPOSTransaction: false },
    [UserRole.VIEWER]: { canManageUsers: false, canManageSettings: false, canManageCOA: false, canEntryJournal: false, canApproveJournal: false, canDeleteJournal: false, canViewReports: true, canManageInventory: false, canManagePurchasing: false, canManageSales: false, canOperatePOS: false, canVoidPOSTransaction: false },
    [UserRole.KARYAWAN]: { canManageUsers: false, canManageSettings: false, canManageCOA: false, canEntryJournal: false, canApproveJournal: false, canDeleteJournal: false, canViewReports: false, canManageInventory: false, canManagePurchasing: false, canManageSales: false, canOperatePOS: true, canVoidPOSTransaction: false },
  };

  // Akun yang relevan untuk KARYAWAN (kode 116xxxxx = Uang Muka Karyawan)
  const karyawanAccounts = allAccounts.filter(a => !a.isHeader && a.code.startsWith('116'));

  useEffect(() => {
    usersService.getAll().then(setUsers).catch(console.error);
    accountsService.getAll().then((accs: HierarchicalAccount[]) => setAllAccounts(accs)).catch(console.error);
  }, []);

  const handleOpenUserModal = (user?: ApiUser) => {
    if (user) {
      setEditingUser(user);
      setUserForm({ name: user.name, email: user.email, password: '', role: user.role, isActive: user.isActive, linkedAccountId: user.linkedAccountId || '' });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role: UserRole.ACCOUNTANT, isActive: true, linkedAccountId: '' });
    }
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (id: number) => {
    if (!await confirm("Yakin ingin menonaktifkan user ini?", { title: 'Nonaktifkan User', variant: 'warning', confirmLabel: 'Ya, Nonaktifkan' })) return;
    try {
      await usersService.delete(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: false } : u));
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus user', 'error');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email) { toast("Nama dan Email wajib diisi.", 'warning'); return; }
    if (!editingUser && !userForm.password) { toast("Password wajib diisi untuk user baru.", 'warning'); return; }
    if (userForm.role === UserRole.KARYAWAN && !userForm.linkedAccountId) {
      toast("Pilih akun karyawan untuk role KARYAWAN.", 'warning'); return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        isActive: userForm.isActive,
        linkedAccountId: userForm.role === UserRole.KARYAWAN ? userForm.linkedAccountId : null,
      };
      if (editingUser) {
        const updated = await usersService.update(editingUser.id, payload);
        setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
        if (userForm.password) await usersService.changePassword(editingUser.id, userForm.password);
      } else {
        const created = await usersService.create({ ...payload, password: userForm.password });
        setUsers(prev => [...prev, created]);
      }
      setIsUserModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Manajemen Pengguna & Hak Akses</h3>
          <p className="text-sm text-gray-500">Kelola user dan konfigurasi fitur yang dapat diakses oleh setiap role.</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('USERS')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'USERS' ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>Daftar User</button>
          <button onClick={() => setActiveTab('ROLES')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'ROLES' ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>Konfigurasi Role</button>
        </div>
      </div>

      {activeTab === 'USERS' ? (
        <>
          <div className="flex justify-end">
            <button onClick={() => handleOpenUserModal()} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Tambah User
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-6 py-3">Nama</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-3 text-gray-500">{user.email}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === UserRole.SUPERADMIN ? 'bg-purple-100 text-purple-700' : user.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : user.role === UserRole.SUPERVISOR ? 'bg-blue-100 text-blue-700' : user.role === UserRole.ACCOUNTANT ? 'bg-green-100 text-green-700' : user.role === UserRole.KARYAWAN ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`flex items-center gap-1.5 ${user.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleOpenUserModal(user)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-48 bg-gray-100">Fitur / Akses</th>
                {Object.values(UserRole).map(role => <th key={role} className="px-4 py-3 text-center min-w-[100px]">{role}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {([
                { key: 'canViewReports', label: 'Melihat Laporan' },
                { key: 'canEntryJournal', label: 'Input Jurnal' },
                { key: 'canApproveJournal', label: 'Approve / Post Jurnal' },
                { key: 'canDeleteJournal', label: 'Hapus / Void Jurnal' },
                { key: 'canManageCOA', label: 'Kelola Daftar Akun' },
                { key: 'canManageSettings', label: 'Akses Pengaturan' },
                { key: 'canManageUsers', label: 'Kelola User' },
              ]).map(perm => (
                <tr key={perm.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700 bg-gray-50/50">{perm.label}</td>
                  {Object.values(UserRole).map(role => (
                    <td key={`${role}-${perm.key}`} className="px-4 py-3 text-center">
                      {(defaultPermissions[role] as any)[perm.key]
                        ? <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
                        : <div className="w-5 h-5 mx-auto border-2 border-gray-200 rounded" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-yellow-50 p-3 text-xs text-yellow-800 border-t border-yellow-100 flex gap-2">
            <Shield className="w-4 h-4" /> Konfigurasi role ditentukan saat setup user dari tabel di atas.
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">{editingUser ? 'Edit User' : 'Tambah User Baru'}</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input required type="text" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Login</label>
                <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingUser && <span className="text-gray-400 font-normal">(kosongkan jika tidak ingin ganti)</span>}
                </label>
                <input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as UserRole, linkedAccountId: '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select value={userForm.isActive ? 'Active' : 'Inactive'} onChange={e => setUserForm({ ...userForm, isActive: e.target.value === 'Active' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              {userForm.role === UserRole.KARYAWAN && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Akun Karyawan <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal ml-1">(Buku Besar yang bisa dilihat)</span>
                  </label>
                  <select
                    value={userForm.linkedAccountId}
                    onChange={e => setUserForm({ ...userForm, linkedAccountId: e.target.value })}
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">-- Pilih Akun Karyawan --</option>
                    {karyawanAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Menampilkan akun 116xxxxx (Uang Muka Karyawan)</p>
                </div>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
