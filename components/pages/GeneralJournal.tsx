import React, { useState, useEffect, useRef } from 'react';
import { JournalEntry, JournalLine, HierarchicalAccount, AccountType, CompanyProfile, Contact } from '../../types';
import { Plus, Trash2, Save, X, Search, FileText, ArrowLeft, Check, Upload, Download, Edit2, AlertCircle, Calendar, Database, Printer, Filter, List, Ban, ArrowRight, Building, Users, Paperclip, Eye, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUI } from '../../src/context/UIContext';
import { useAuth } from '../../src/context/AuthContext';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import { contactsService } from '../../src/services/contacts.service';
import { settingsService, periodsService } from '../../src/services/settings.service';

// --- UTILITIES ---
const formatNumber = (num: string | number): string => {
  if (!num) return '';
  const cleanStr = num.toString().replace(/\D/g, '');
  return cleanStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseNumber = (str: string): number => {
  if (!str) return 0;
  return Number(str.replace(/\./g, ''));
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatNumberOnly = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
};

const formatAccountCode = (code: string): string => {
  const clean = code.replace(/\D/g, '');
  if (clean.length > 8) return clean.slice(0, 8); 
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
};

const getShortAccountName = (fullName: string) => {
    const parts = fullName.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ') : fullName;
};

const getJournalSummary = (lines: JournalLine[]) => {
    const debits = lines.filter(l => l.debit > 0);
    const credits = lines.filter(l => l.credit > 0);

    if (debits.length === 0 || credits.length === 0) return "Draft / Tidak Seimbang";

    const drName = getShortAccountName(debits[0].accountName);
    const crName = getShortAccountName(credits[0].accountName);

    let summary = "";
    
    // Dr Logic
    summary += drName;
    if (debits.length > 1) summary += ` (+${debits.length - 1})`;

    let crText = crName;
    if (credits.length > 1) crText += ` (+${credits.length - 1})`;

    return { dr: summary, cr: crText };
};

// --- SEED DATA DEFINITIONS ---
const REQUIRED_SEED_ACCOUNTS: Partial<HierarchicalAccount>[] = [
    { code: '11101001', name: 'Kas Kecil', type: AccountType.ASSET },
    { code: '11101002', name: 'Kas Besar', type: AccountType.ASSET },
    { code: '11102001', name: 'Bank BCA', type: AccountType.ASSET },
    { code: '11201001', name: 'Piutang Usaha', type: AccountType.ASSET },
    { code: '11301001', name: 'Stok ATK & Perlengkapan', type: AccountType.ASSET },
    { code: '11401001', name: 'Sewa Dibayar Dimuka', type: AccountType.ASSET },
    { code: '12101001', name: 'Peralatan Elektronik', type: AccountType.ASSET },
    { code: '12101002', name: 'Inventaris Furnitur', type: AccountType.ASSET },
    { code: '12102001', name: 'Akum. Peny. Peralatan', type: AccountType.ASSET },
    { code: '21101001', name: 'Utang Usaha', type: AccountType.LIABILITY },
    { code: '22101001', name: 'Utang Bank Jangka Panjang', type: AccountType.LIABILITY },
    { code: '31101001', name: 'Modal Disetor', type: AccountType.EQUITY },
    { code: '31201001', name: 'Prive Pemilik', type: AccountType.EQUITY },
    { code: '41101001', name: 'Pendapatan Jasa', type: AccountType.REVENUE },
    { code: '42101001', name: 'Pendapatan Bunga Bank', type: AccountType.REVENUE },
    { code: '51101001', name: 'Beban Gaji Staff', type: AccountType.EXPENSE },
    { code: '51101002', name: 'Beban Tunjangan Makan', type: AccountType.EXPENSE },
    { code: '51201001', name: 'Beban Sewa Kantor', type: AccountType.EXPENSE },
    { code: '51202001', name: 'Beban Listrik', type: AccountType.EXPENSE },
    { code: '51202002', name: 'Beban Air', type: AccountType.EXPENSE },
    { code: '51202003', name: 'Beban Internet', type: AccountType.EXPENSE },
    { code: '51301001', name: 'Beban Iklan', type: AccountType.EXPENSE },
    { code: '51401001', name: 'Beban Peny. Aset Tetap', type: AccountType.EXPENSE },
    { code: '52101001', name: 'Beban Administrasi Bank', type: AccountType.EXPENSE },
];

export const GeneralJournal: React.FC = () => {
  const { toast, confirm } = useUI();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // --- STATE ---
  const [view, setView] = useState<'list' | 'form'>('list');
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  // Map kode akun (8 digit clean) → nama akun, termasuk header — untuk lookup nama parent di cetak voucher
  const [accountsByCode, setAccountsByCode] = useState<Map<string, string>>(new Map());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'POSTED' | 'VOID'>('POSTED');
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), accountId: '', accountName: '', debit: 0, credit: 0, description: '' },
    { id: crypto.randomUUID(), accountId: '', accountName: '', debit: 0, credit: 0, description: '' }
  ]);
  const [lineInputs, setLineInputs] = useState<{debit: string, credit: string}[]>([
    { debit: '', credit: '' },
    { debit: '', credit: '' }
  ]);
  
  const [formError, setFormError] = useState<string | null>(null);

  // Autocomplete State
  const [focusedLineIndex, setFocusedLineIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Account Selection Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Quick Add Account State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ code: '', name: '' });

  // Import Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed Data Modal State
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [seedMonth, setSeedMonth] = useState(new Date().toISOString().slice(0, 7)); // Default: Current Month YYYY-MM

  // Printing State (Single Voucher)
  const [printingJournal, setPrintingJournal] = useState<JournalEntry | null>(null);
  const voucherRef = useRef<HTMLDivElement>(null);

  // Printing State (Batch Report)
  const [isPrintingBatch, setIsPrintingBatch] = useState(false);

  // New Feature: Journal List Report State
  const [isJournalListOpen, setIsJournalListOpen] = useState(false);
  const journalListRef = useRef<HTMLDivElement>(null);

  // Company Profile State for Print Header
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Attachment State
  const [formAttachment, setFormAttachment] = useState<string | null>(null);
  const [formAttachmentName, setFormAttachmentName] = useState<string | null>(null);
  const [attachModalJournal, setAttachModalJournal] = useState<JournalEntry | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ data: string; name: string } | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());
  const toggleJournalExpand = (id: string) => {
    setExpandedJournals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const quickAttachInputRef = useRef<HTMLInputElement>(null);

  // --- EFFECTS ---
  useEffect(() => {
    Promise.all([
      accountsService.getAll(),
      journalsService.getAll(),
      settingsService.getProfile(),
      contactsService.getAll(),
      periodsService.getAll(),
    ]).then(([allAccounts, allJournals, profile, allContacts, periods]) => {
      setAccounts(allAccounts.filter(a => !a.isHeader));
      // Bangun map code→name dari SEMUA akun (termasuk header) untuk lookup nama parent
      const codeMap = new Map<string, string>();
      allAccounts.forEach(a => codeMap.set(a.code.replace(/\D/g, ''), a.name));
      setAccountsByCode(codeMap);
      setJournals(allJournals);
      setCompanyProfile(profile);
      setContacts(allContacts);

      // Set filter dates from active period
      const active = periods.find(p => p.isActive);
      if (active) {
        setFilterStartDate(`${active.year}-01-01`);
        setFilterEndDate(`${active.year}-12-31`);
      }
    }).catch(() => {
      toast('Gagal memuat data dari server.', 'error');
    }).finally(() => setIsLoading(false));
  }, []);

  // Auto focus search input when modal opens
  useEffect(() => {
    if (isAccountModalOpen && searchInputRef.current) {
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    }
  }, [isAccountModalOpen]);

  // --- HELPER: CHECK CONTACT REQUIREMENT ---
  const isContactRequired = (accountCode: string) => {
      // 112 = Piutang (Receivable) -> Need Customer
      if (accountCode.startsWith('112')) return 'CUSTOMER';
      // 211 = Utang (Payable) -> Need Vendor
      if (accountCode.startsWith('211')) return 'VENDOR';
      return null;
  };

  const getContactsByType = (type: 'CUSTOMER' | 'VENDOR') => {
      return contacts.filter(c => c.type === type || c.type === 'BOTH');
  };

  // --- FILTER LOGIC ---
  
  // Preset Date Handlers
  const applyDatePreset = (preset: 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL') => {
      const now = new Date();
      let start = '';
      let end = '';

      if (preset === 'TODAY') {
          start = now.toISOString().split('T')[0];
          end = start;
      } else if (preset === 'THIS_MONTH') {
          start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (preset === 'LAST_MONTH') {
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
          end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      } else if (preset === 'ALL') {
          start = '';
          end = '';
      }

      setFilterStartDate(start);
      setFilterEndDate(end);
  };

  const filteredJournals = journals.filter(journal => {
    // Search Query (No Bukti OR Description)
    const matchesSearch = 
        searchQuery === '' || 
        journal.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
        journal.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date Range Filter (Only apply if filters are set)
    let matchesDate = true;
    if (filterStartDate) {
        matchesDate = matchesDate && journal.transactionDate >= filterStartDate;
    }
    if (filterEndDate) {
        matchesDate = matchesDate && journal.transactionDate <= filterEndDate;
    }

    return matchesSearch && matchesDate;
  })
  // Sort descending by date (newest first) for UI, ensuring latest data is on top
  .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id));

  // --- LOGIC: DETECT ACCOUNT ATTRIBUTES ---
  const detectAccountAttributes = (code: string) => {
    if (!code || code.length === 0) return { type: AccountType.ASSET, level: 1, isHeader: true };

    const cleanCode = code.padEnd(8, '0'); 
    
    // 1. Detect Type based on First Digit
    let type = AccountType.ASSET;
    const firstChar = cleanCode.charAt(0);
    switch(firstChar) {
      case '1': type = AccountType.ASSET; break;
      case '2': type = AccountType.LIABILITY; break;
      case '3': type = AccountType.EQUITY; break;
      case '4': type = AccountType.REVENUE; break;
      case '5': type = AccountType.EXPENSE; break;
      default: type = AccountType.ASSET;
    }

    // 2. Detect Level
    let level = 5;
    let isHeader = false; 
    
    return { type, level, isHeader };
  };

  const getCategoryLabel = (type: AccountType) => {
    switch(type) {
      case AccountType.ASSET: return 'Harta (Asset)';
      case AccountType.LIABILITY: return 'Kewajiban (Liability)';
      case AccountType.EQUITY: return 'Modal (Equity)';
      case AccountType.REVENUE: return 'Pendapatan (Revenue)';
      case AccountType.EXPENSE: return 'Beban (Expense)';
      default: return type;
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickForm.code || quickForm.code.length !== 8) {
          toast("Kode Akun harus 8 digit.", 'warning');
          return;
      }

      // Check Duplicate locally
      if (accounts.some(a => a.code === quickForm.code)) {
          toast("Kode akun sudah ada.", 'warning');
          return;
      }

      const { type, level, isHeader } = detectAccountAttributes(quickForm.code);

      try {
        const created = await accountsService.create({
          code: quickForm.code,
          name: quickForm.name,
          type,
          level,
          isHeader,
          balance: 0,
        });
        setAccounts(prev => [...prev, created]);
        setIsQuickAddOpen(false);
        setQuickForm({ code: '', name: '' });
        setAccountSearchQuery(created.code);
      } catch (err: any) {
        toast(err.message || 'Gagal menambah akun.', 'error');
      }
  };

  // --- SEED DUMMY DATA LOGIC ---
  const handleOpenSeedModal = () => {
    setIsSeedModalOpen(true);
  };

  const executeSeedData = async () => {
    setIsSaving(true);
    try {
        // 1. Upsert seed accounts via API
        const seedAccountPayloads = REQUIRED_SEED_ACCOUNTS.filter(r => r.code && r.name && r.type).map(r => ({
          id: '',
          code: r.code!,
          name: r.name!,
          type: r.type!,
          level: 5,
          isHeader: false,
          balance: 0,
        }));
        const upsertedAccounts = await accountsService.bulkCreate(seedAccountPayloads);

        // Refresh all detail accounts
        const allAccounts = await accountsService.getAll();
        const detailAccounts = allAccounts.filter(a => !a.isHeader);
        setAccounts(detailAccounts);

        const getAccId = (code: string) => {
            const found = detailAccounts.find(a => a.code === code);
            return found ? found.id : 'unknown';
        };
        const getAccName = (code: string) => {
            const found = detailAccounts.find(a => a.code === code);
            return found ? `${found.code} - ${found.name}` : `UNKNOWN (${code})`;
        };

        const [year, month] = seedMonth.split('-');
        const yearMonth = `${year}-${month}`;
        const refSuffix = `${year}${month}`;
        const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

        const dummyTemplates = [
            { day: '01', refCode: '001', desc: 'Setoran Modal Awal Pemilik', lines: [{ code: '11102001', debit: 500000000, credit: 0 }, { code: '31101001', debit: 0, credit: 500000000 }] },
            { day: '02', refCode: '002', desc: 'Bayar Sewa Kantor 1 Tahun', lines: [{ code: '11401001', debit: 60000000, credit: 0 }, { code: '11102001', debit: 0, credit: 60000000 }] },
            { day: '03', refCode: '003', desc: 'Pembelian 5 Unit Laptop Operasional', lines: [{ code: '12101001', debit: 75000000, credit: 0 }, { code: '11102001', debit: 0, credit: 75000000 }] },
            { day: '04', refCode: '004', desc: 'Pembelian Stok ATK & Kertas', lines: [{ code: '11301001', debit: 2500000, credit: 0 }, { code: '11101002', debit: 0, credit: 2500000 }] },
            { day: '05', refCode: '005', desc: 'Pendapatan Jasa Konsultasi (Tunai)', lines: [{ code: '11102001', debit: 15000000, credit: 0 }, { code: '41101001', debit: 0, credit: 15000000 }] },
            { day: '06', refCode: '006', desc: 'Pembayaran Iklan Facebook Ads', lines: [{ code: '51301001', debit: 5000000, credit: 0 }, { code: '11102001', debit: 0, credit: 5000000 }] },
            { day: '08', refCode: '007', desc: 'Pendapatan Jasa Proyek Website (Piutang)', lines: [{ code: '11201001', debit: 45000000, credit: 0 }, { code: '41101001', debit: 0, credit: 45000000 }] },
            { day: '10', refCode: '008', desc: 'Pembelian Meja & Kursi Kantor (Kredit)', lines: [{ code: '12101002', debit: 12000000, credit: 0 }, { code: '21101001', debit: 0, credit: 12000000 }] },
            { day: '12', refCode: '009', desc: 'Pembayaran Listrik Bulanan', lines: [{ code: '51202001', debit: 1500000, credit: 0 }, { code: '11101002', debit: 0, credit: 1500000 }] },
            { day: '12', refCode: '010', desc: 'Pembayaran Internet & Air', lines: [{ code: '51202003', debit: 750000, credit: 0 }, { code: '51202002', debit: 250000, credit: 0 }, { code: '11101002', debit: 0, credit: 1000000 }] },
            { day: '15', refCode: '011', desc: 'Terima Pelunasan Piutang Sebagian', lines: [{ code: '11102001', debit: 20000000, credit: 0 }, { code: '11201001', debit: 0, credit: 20000000 }] },
            { day: '18', refCode: '012', desc: 'Pembayaran Cicilan Furniture', lines: [{ code: '21101001', debit: 6000000, credit: 0 }, { code: '11102001', debit: 0, credit: 6000000 }] },
            { day: '20', refCode: '013', desc: 'Penarikan Prive Pemilik', lines: [{ code: '31201001', debit: 5000000, credit: 0 }, { code: '11102001', debit: 0, credit: 5000000 }] },
            { day: '22', refCode: '014', desc: 'Pendapatan Jasa Training (Tunai)', lines: [{ code: '11102001', debit: 8000000, credit: 0 }, { code: '41101001', debit: 0, credit: 8000000 }] },
            { day: '25', refCode: '015', desc: 'Pembayaran Gaji Karyawan', lines: [{ code: '51101001', debit: 35000000, credit: 0 }, { code: '11102001', debit: 0, credit: 35000000 }] },
            { day: '25', refCode: '016', desc: 'Reimburse Uang Makan Lembur (Kas Kecil)', lines: [{ code: '51101002', debit: 1200000, credit: 0 }, { code: '11101001', debit: 0, credit: 1200000 }] },
            { day: '28', refCode: '017', desc: 'Pencairan Pinjaman Bank Mandiri', lines: [{ code: '11102001', debit: 200000000, credit: 0 }, { code: '22101001', debit: 0, credit: 200000000 }] },
            { day: lastDayOfMonth.toString(), refCode: '018', desc: 'Pendapatan Bunga & Biaya Admin Bank', lines: [{ code: '11102001', debit: 450000, credit: 0 }, { code: '52101001', debit: 50000, credit: 0 }, { code: '42101001', debit: 0, credit: 500000 }] },
            { day: lastDayOfMonth.toString(), refCode: '019', desc: 'AJP: Amortisasi Sewa Kantor (1/12)', lines: [{ code: '51201001', debit: 5000000, credit: 0 }, { code: '11401001', debit: 0, credit: 5000000 }] },
            { day: lastDayOfMonth.toString(), refCode: '020', desc: 'AJP: Penyusutan Laptop & Furniture', lines: [{ code: '51401001', debit: 2500000, credit: 0 }, { code: '12102001', debit: 0, credit: 2500000 }] }
        ];

        // 2. Create journal entries sequentially via API
        const createdJournals: JournalEntry[] = [];
        for (const tx of dummyTemplates) {
            const jLines = tx.lines.map(l => ({
                id: '',
                accountId: getAccId(l.code),
                accountName: getAccName(l.code),
                debit: l.debit,
                credit: l.credit,
                description: '',
            }));
            const dayStr = tx.day.toString().padStart(2, '0');
            const created = await journalsService.create({
                id: '',
                transactionDate: `${yearMonth}-${dayStr}`,
                referenceNumber: `JV-${refSuffix}-${tx.refCode}`,
                description: tx.desc,
                lines: jLines,
                totalAmount: jLines.reduce((s, l) => s + l.debit, 0),
                createdAt: new Date().toISOString(),
                createdBy: 'System (Seed)',
                status: 'POSTED',
            });
            createdJournals.push(created);
        }

        setJournals(prev => [...createdJournals, ...prev]);
        setIsSeedModalOpen(false);
        toast(`Berhasil membuat ${createdJournals.length} jurnal dummy untuk periode ${yearMonth}. ${upsertedAccounts.length} akun diproses.`, 'success');

        const firstOfSeed = `${yearMonth}-01`;
        const endOfSeed = `${yearMonth}-${lastDayOfMonth}`;
        setFilterStartDate(firstOfSeed);
        setFilterEndDate(endOfSeed);
    } catch (error: any) {
        console.error("Generate Dummy Data Failed:", error);
        toast(error.message || "Terjadi kesalahan saat membuat data dummy. Silakan coba lagi.", 'error');
    } finally {
        setIsSaving(false);
    }
  };

  // --- FORM LOGIC ---
  const handleAddLine = () => {
    setLines([...lines, { id: Date.now().toString(), accountId: '', accountName: '', debit: 0, credit: 0, description: '' }]);
    setLineInputs([...lineInputs, { debit: '', credit: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
    const newInputs = [...lineInputs];
    newInputs.splice(index, 1);
    setLineInputs(newInputs);
  };

  const handleOpenAccountModal = (index: number) => {
    setActiveLineIndex(index);
    setAccountSearchQuery('');
    setIsAccountModalOpen(true);
  };

  const handleSelectAccount = (index: number | null, account: HierarchicalAccount) => {
    if (index === null) return;
    const newLines = [...lines];
    newLines[index].accountId = account.id;
    newLines[index].accountName = `${account.code} - ${account.name}`;
    // Smart Default: If line description is empty, use header description
    if (!newLines[index].description) {
        newLines[index].description = description;
    }
    // Reset contact when account changes
    newLines[index].contactId = undefined;
    newLines[index].contactName = undefined;
    setLines(newLines);
    setIsAccountModalOpen(false);
    setActiveLineIndex(null);
    setFocusedLineIndex(null);
  };

  const handleContactChange = (index: number, contactId: string) => {
      const newLines = [...lines];
      const contact = contacts.find(c => c.id === contactId);
      newLines[index].contactId = contactId;
      newLines[index].contactName = contact ? contact.name : undefined;
      setLines(newLines);
  };

  const handleLineDescriptionChange = (index: number, value: string) => {
      const newLines = [...lines];
      newLines[index].description = value;
      setLines(newLines);
  };

  const handleAccountInputChange = (index: number, value: string) => {
    const newLines = [...lines];
    newLines[index].accountName = value;
    newLines[index].accountId = ''; 
    newLines[index].contactId = undefined;
    setLines(newLines);
    setFocusedLineIndex(index);
    setHighlightedIndex(0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, index: number) => {
    const suggestions = getSuggestions(lines[index].accountName);
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions.length > 0 && suggestions[highlightedIndex]) {
            handleSelectAccount(index, suggestions[highlightedIndex]);
        }
    } else if (e.key === 'Escape') {
        setFocusedLineIndex(null);
    }
  };

  const getSuggestions = (query: string) => {
      if (!query) return [];
      const lower = query.toLowerCase();
      return sortedAccounts.filter(acc => 
          acc.code.toLowerCase().includes(lower) || 
          acc.name.toLowerCase().includes(lower)
      ).slice(0, 8);
  };

  const handleAmountChange = (index: number, type: 'debit' | 'credit', value: string) => {
    const rawVal = value.replace(/\D/g, '');
    const formatted = formatNumber(rawVal);
    const numVal = parseNumber(formatted);
    const newInputs = [...lineInputs];
    const newLines = [...lines];
    if (type === 'debit') {
      newInputs[index] = { debit: formatted, credit: formatted ? '0' : newInputs[index].credit };
      newLines[index].debit = numVal;
      if (numVal > 0) {
        newInputs[index].credit = '';
        newLines[index].credit = 0;
      }
    } else {
      newInputs[index] = { credit: formatted, debit: formatted ? '0' : newInputs[index].debit };
      newLines[index].credit = numVal;
      if (numVal > 0) {
        newInputs[index].debit = '';
        newLines[index].debit = 0;
      }
    }
    setLineInputs(newInputs);
    setLines(newLines);
  };

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleEdit = (journal: JournalEntry) => {
      setEditingId(journal.id);
      setEntryDate(journal.transactionDate);
      setReference(journal.referenceNumber);
      setDescription(journal.description);
      setFormStatus(journal.status);
      setFormAttachment(journal.attachment ?? null);
      setFormAttachmentName(journal.attachmentName ?? null);
      const populatedLines = journal.lines.map(l => ({
          ...l,
          description: l.description || ''
      }));
      setLines(populatedLines);
      const populatedInputs = journal.lines.map(l => ({
          debit: l.debit > 0 ? formatNumber(l.debit) : '',
          credit: l.credit > 0 ? formatNumber(l.credit) : ''
      }));
      setLineInputs(populatedInputs);
      setView('form');
  };

  // SUPERADMIN-only: download JSON backup of journals right before they're permanently deleted
  const downloadJournalBackup = (deletedJournals: JournalEntry[]) => {
      const payload = {
          deletedAt: new Date().toISOString(),
          deletedBy: user?.name || user?.email || 'unknown',
          count: deletedJournals.length,
          journals: deletedJournals,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = payload.deletedAt.replace(/[:.]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-jurnal-dihapus-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
      if (!await confirm("Apakah Anda yakin ingin menghapus jurnal ini? Tindakan ini tidak dapat dibatalkan.", { title: 'Hapus Jurnal', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
      const journalToBackup = journals.find(j => j.id === id);
      try {
          await journalsService.delete(id);
          setJournals(prev => prev.filter(j => j.id !== id));
          setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          if (journalToBackup) downloadJournalBackup([journalToBackup]);
      } catch (err: any) {
          toast(err.message || 'Gagal menghapus jurnal.', 'error');
      }
  };

  const toggleSelectJournal = (id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
      });
  };

  const toggleSelectAllJournals = () => {
      setSelectedIds(prev =>
          prev.size === filteredJournals.length ? new Set() : new Set(filteredJournals.map(j => j.id))
      );
  };

  const handleBulkDelete = async () => {
      const count = selectedIds.size;
      if (count === 0) return;
      if (!await confirm(`Anda akan menghapus ${count} jurnal sekaligus secara permanen, termasuk jurnal yang sudah POSTED. Tindakan ini TIDAK DAPAT DIBATALKAN.`, { title: 'Hapus Jurnal Secara Massal', variant: 'danger', confirmLabel: `Ya, Hapus ${count} Jurnal` })) return;
      const ids = Array.from(selectedIds);
      const journalsToBackup = journals.filter(j => selectedIds.has(j.id));
      try {
          await journalsService.bulkDelete(ids);
          setJournals(prev => prev.filter(j => !selectedIds.has(j.id)));
          setSelectedIds(new Set());
          if (journalsToBackup.length > 0) downloadJournalBackup(journalsToBackup);
          toast(`${count} jurnal berhasil dihapus.`, 'success');
      } catch (err: any) {
          toast(err.message || 'Gagal menghapus jurnal secara massal.', 'error');
      }
  };

  const handleVoid = async (id: string) => {
      if (!await confirm("Apakah Anda yakin ingin membatalkan (VOID) jurnal ini? Statusnya menjadi VOID dan tidak akan dihitung dalam laporan.", { title: 'Batalkan Jurnal (VOID)', variant: 'warning', confirmLabel: 'Ya, VOID-kan' })) return;
      try {
          const updated = await journalsService.updateStatus(id, 'VOID');
          setJournals(prev => prev.map(j => j.id === id ? updated : j));
      } catch (err: any) {
          toast(err.message || 'Gagal membatalkan jurnal.', 'error');
      }
  };

  const resetForm = () => {
    setView('list');
    setEditingId(null);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setDescription('');
    setFormStatus('POSTED');
    setFormAttachment(null);
    setFormAttachmentName(null);
    setLines([
      { id: crypto.randomUUID(), accountId: '', accountName: '', debit: 0, credit: 0, description: '' },
      { id: crypto.randomUUID(), accountId: '', accountName: '', debit: 0, credit: 0, description: '' }
    ]);
    setLineInputs([ { debit: '', credit: '' }, { debit: '', credit: '' } ]);
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!reference) { setFormError("Nomor Bukti wajib diisi."); return; }
    if (!description) { setFormError("Keterangan / Deskripsi wajib diisi."); return; }
    if (lines.some(l => !l.accountId)) { setFormError("Semua baris harus memiliki akun yang valid."); return; }
    if (lines.some(l => l.debit === 0 && l.credit === 0)) { setFormError("Nominal tidak boleh nol."); return; }

    if (!isBalanced) return;

    const payload: JournalEntry = {
      id: editingId || '',
      transactionDate: entryDate,
      referenceNumber: reference,
      description: description,
      attachment: formAttachment,
      attachmentName: formAttachmentName,
      lines: lines,
      totalAmount: totalDebit,
      createdAt: editingId ? (journals.find(j => j.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      createdBy: 'Admin',
      status: formStatus
    };

    setIsSaving(true);
    try {
      if (editingId) {
        const updated = await journalsService.update(editingId, payload);
        setJournals(prev => prev.map(j => j.id === editingId ? updated : j));
      } else {
        const created = await journalsService.create(payload);
        setJournals(prev => [created, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan jurnal.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- ATTACHMENT HANDLERS ---
  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Handler for attachment in the EDIT FORM
  const handleFormAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast('Ukuran file terlalu besar. Maksimal 3MB.', 'warning'); return; }
    const base64 = await readFileAsBase64(file);
    setFormAttachment(base64);
    setFormAttachmentName(file.name);
    e.target.value = '';
  };

  // Handler for QUICK ATTACH from list view (works for any status)
  const handleQuickAttachChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!attachModalJournal) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast('Ukuran file terlalu besar. Maksimal 3MB.', 'warning'); return; }
    setIsAttaching(true);
    try {
      const base64 = await readFileAsBase64(file);
      const updated = await journalsService.updateAttachment(attachModalJournal.id, base64, file.name);
      setJournals(prev => prev.map(j => j.id === updated.id ? updated : j));
      setAttachModalJournal(updated);
      toast('Lampiran berhasil disimpan.', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan lampiran.', 'error');
    } finally {
      setIsAttaching(false);
      e.target.value = '';
    }
  };

  // Remove attachment from quick-attach modal
  const handleQuickRemoveAttachment = async () => {
    if (!attachModalJournal) return;
    if (!await confirm('Hapus lampiran bukti transaksi ini?', { title: 'Hapus Lampiran', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    setIsAttaching(true);
    try {
      const updated = await journalsService.updateAttachment(attachModalJournal.id, null, null);
      setJournals(prev => prev.map(j => j.id === updated.id ? updated : j));
      setAttachModalJournal(updated);
      toast('Lampiran dihapus.', 'info');
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus lampiran.', 'error');
    } finally {
      setIsAttaching(false);
    }
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
      if (journals.length === 0) {
          toast("Belum ada data jurnal untuk diexport.", 'warning');
          return;
      }
      const exportData = journals.flatMap(journal => 
          journal.lines.map(line => {
              const parts = line.accountName.split(' - ');
              return {
                  'Tanggal': journal.transactionDate,
                  'No. Bukti': journal.referenceNumber,
                  'Keterangan Umum': journal.description,
                  'Status': journal.status,
                  'Kode Akun': parts.length > 1 ? parts[0] : '',
                  'Nama Akun': parts.length > 1 ? parts.slice(1).join(' - ') : line.accountName,
                  'Keterangan Baris': line.description || '',
                  'Debit': line.debit,
                  'Kredit': line.credit
              };
          })
      );
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wscols = [{wch: 12}, {wch: 15}, {wch: 40}, {wch: 10}, {wch: 10}, {wch: 30}, {wch: 15}, {wch: 15}];
      ws['!cols'] = wscols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Jurnal");
      XLSX.writeFile(wb, `Jurnal_Umum_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- IMPORT EXCEL ---
  const handleDownloadTemplate = () => {
    const templateData = [
      ["Tanggal", "No Bukti", "Keterangan Umum", "Kode Akun", "Keterangan Baris", "Debit", "Kredit"],
      ["01-01-2025", "JV-001", "Setoran Modal", "11102001", "Setoran Modal Awal (Bank)", 10000000, 0],
      ["01-01-2025", "JV-001", "Setoran Modal", "31101001", "Modal Disetor Pemilik", 0, 10000000]
    ];
    const wsTemplate = XLSX.utils.aoa_to_sheet(templateData);
    const accountRefData = [["Kode Akun", "Nama Akun", "Kategori"]];
    [...accounts].sort((a,b) => a.code.localeCompare(b.code)).forEach(acc => {
      accountRefData.push([acc.code, acc.name, acc.type]);
    });
    const wsRef = XLSX.utils.aoa_to_sheet(accountRefData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Input Jurnal");
    XLSX.utils.book_append_sheet(wb, wsRef, "Referensi Akun");
    XLSX.writeFile(wb, "Template_Import_Jurnal.xlsx");
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImportFile(e.target.files[0]);
  };

  /** Parse tanggal dari file import (template pakai format dd-mm-yyyy), tetap dukung yyyy-mm-dd & tanggal asli Excel untuk kompatibilitas file lama. */
  const parseImportDate = (rawDate: any): string => {
    if (rawDate instanceof Date) return rawDate.toISOString().split('T')[0];
    if (typeof rawDate === 'string') {
      const trimmed = rawDate.trim();
      // dd-mm-yyyy atau dd/mm/yyyy (format template terbaru)
      let m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        const [, d, mo, y] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // yyyy-mm-dd (format template lama, tetap didukung)
      m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) {
        const [, y, mo, d] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  const handleImportSubmit = () => {
    if (!importFile) { toast("Silakan pilih file Excel.", 'warning'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (jsonData.length === 0) { toast("File kosong.", 'error'); return; }

      const groupedData: Record<string, any[]> = {};
      jsonData.forEach((row: any) => {
        const ref = row['No Bukti'] || row['Reference'] || row['Ref'];
        if (ref) {
          if (!groupedData[ref]) groupedData[ref] = [];
          groupedData[ref].push(row);
        }
      });

      const newJournals: JournalEntry[] = [];
      const errors: string[] = [];
      const timestamp = Date.now();
      let index = 0;

      Object.keys(groupedData).forEach((ref) => {
        const rows = groupedData[ref];
        const lines: JournalLine[] = [];
        let totalD = 0;
        let totalC = 0;
        let date = '';
        let desc = '';
        let isValid = true;

        rows.forEach((row: any, rIdx) => {
          if (!date) {
              const rawDate = row['Tanggal'] || row['Date'];
              date = parseImportDate(rawDate);
          }
          if (!desc) desc = row['Keterangan Umum'] || row['Keterangan'] || row['Description'] || '';
          const codeRaw = String(row['Kode Akun'] || row['Code']).replace(/\D/g, '');
          const lineDesc = row['Keterangan Baris'] || row['Line Description'] || desc;
          const debit = Number(row['Debit'] || 0);
          const credit = Number(row['Kredit'] || 0);
          const account = accounts.find(a => a.code === codeRaw);
          if (!account) { errors.push(`[${ref}] Kode Akun ${codeRaw} tidak ditemukan.`); isValid = false; }
          if (isValid && account) {
            lines.push({ 
              id: `line-${timestamp}-${index}-${rIdx}`, 
              accountId: account.id, 
              accountName: `${account.code} - ${account.name}`, 
              description: lineDesc,
              debit, 
              credit 
            });
            totalD += debit; totalC += credit;
          }
        });

        if (isValid) {
          if (Math.abs(totalD - totalC) > 1) { errors.push(`[${ref}] Tidak seimbang.`); isValid = false; }
          else if (totalD === 0) { errors.push(`[${ref}] Nominal 0.`); isValid = false; }
        }

        if (isValid) {
          newJournals.push({ id: `imp-${timestamp}-${index}`, transactionDate: date, referenceNumber: ref, description: desc, lines, totalAmount: totalD, createdAt: new Date().toISOString(), createdBy: 'Import', status: 'POSTED' });
        }
        index++;
      });

      if (errors.length > 0) toast(`Gagal mengimpor beberapa jurnal: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} lainnya)` : ''}`, 'warning');
      if (newJournals.length > 0) {
        setIsSaving(true);
        const created: JournalEntry[] = [];
        const skippedDuplicates: string[] = [];
        const failedOthers: string[] = [];

        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Per-jurnal try/catch: satu No. Bukti yang sudah ada tidak boleh menggagalkan seluruh batch
        // Import besar (ratusan jurnal) bisa kena rate limiter backend (200 req/menit) —
        // jeda antar-request + retry saat 429 mencegah sisa batch gagal massal.
        for (let i = 0; i < newJournals.length; i++) {
          const j = newJournals[i];
          setImportProgress({ done: i, total: newJournals.length });

          let retriesLeft = 3;
          while (true) {
            try {
              const c = await journalsService.create(j);
              created.push(c);
              break;
            } catch (apiErr: any) {
              const status = apiErr?.status;
              if (status === 429 && retriesLeft > 0) {
                retriesLeft--;
                toast(`Kena limit request server, menunggu sebentar lalu lanjut... (${i + 1}/${newJournals.length})`, 'warning');
                await wait(65000);
                continue;
              }
              const msg = String(apiErr?.message || '');
              if (msg.toLowerCase().includes('duplicate entry')) {
                skippedDuplicates.push(j.referenceNumber);
              } else {
                failedOthers.push(`${j.referenceNumber}: ${msg || 'Gagal menyimpan'}`);
              }
              break;
            }
          }

          if (i < newJournals.length - 1) await wait(300);
        }
        setImportProgress({ done: newJournals.length, total: newJournals.length });
        setIsSaving(false);
        setImportProgress(null);

        if (created.length > 0) setJournals(prev => [...created, ...prev]);

        const summaryParts: string[] = [];
        if (created.length > 0) summaryParts.push(`${created.length} jurnal berhasil diimpor`);
        if (skippedDuplicates.length > 0) summaryParts.push(`${skippedDuplicates.length} dilewati (No. Bukti sudah ada: ${skippedDuplicates.slice(0, 5).join(', ')}${skippedDuplicates.length > 5 ? `, +${skippedDuplicates.length - 5} lainnya` : ''})`);
        if (failedOthers.length > 0) summaryParts.push(`${failedOthers.length} gagal: ${failedOthers.slice(0, 3).join('; ')}${failedOthers.length > 3 ? ` (+${failedOthers.length - 3} lainnya)` : ''}`);

        const toastType = failedOthers.length > 0 ? 'error' : (skippedDuplicates.length > 0 ? 'warning' : 'success');
        toast(summaryParts.join('. ') || 'Tidak ada jurnal yang diimpor.', toastType);

        setIsImportModalOpen(false);
        setImportFile(null);
      }
    };
    reader.readAsArrayBuffer(importFile);
  };

  const openPrintTab = (innerContent: string, title: string) => {
    // Vite bundles CSS into JS as inline <style> tags — extract rules directly
    const allCss = Array.from(document.styleSheets).flatMap((ss) => {
      try { return Array.from(ss.cssRules).map((r) => r.cssText); }
      catch { return ss.href ? [`@import url("${ss.href}");`] : []; }
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${title}</title>
  <style>${allCss}</style>
  <style>
    @page { size: A4 portrait; margin: 14mm 14mm 20mm 14mm; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0 !important; background: white !important; padding: 0 !important; }
      .page-wrap { padding: 0 !important; }
      .paper { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 14mm !important; border-radius: 0 !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; }
    body { background: #e5e7eb; font-family: 'Inter', Arial, sans-serif; min-height: 100vh; color: #1e293b; }
    .navbar {
      position: sticky; top: 0; z-index: 9999;
      height: 56px; background: #111827;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px;
      box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.5);
    }
    .navbar-left { display: flex; align-items: center; gap: 10px; }
    .nav-back {
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: transparent; color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .nav-back:hover { background: rgba(255,255,255,0.08); color: white; }
    .nav-divider { width: 1px; height: 20px; background: #374151; }
    .nav-title { color: white; font-weight: 700; font-size: 14px; letter-spacing: 0.02em; }
    .navbar-right { display: flex; align-items: center; gap: 8px; }
    .nbtn {
      height: 34px; padding: 0 14px; border-radius: 7px; border: none;
      cursor: pointer; font-size: 12.5px; font-weight: 700; letter-spacing: 0.02em;
      display: inline-flex; align-items: center; gap: 6px;
      transition: background 0.15s, transform 0.1s;
    }
    .nbtn:active { transform: scale(0.96); }
    .nbtn-print { background: #b91c1c; color: white; }
    .nbtn-print:hover { background: #991b1b; }
    .nbtn-close { background: #374151; color: #d1d5db; }
    .nbtn-close:hover { background: #4b5563; color: white; }
    .page-wrap { padding: 36px 24px 72px; min-height: calc(100vh - 56px); }
    .paper {
      max-width: 210mm; margin: 0 auto; background: white;
      padding: 52px 56px 60px; border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.07);
    }
  </style>
</head>
<body>
  <nav class="navbar no-print">
    <div class="navbar-left">
      <button class="nav-back" onclick="window.close()" title="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
      <div class="nav-divider"></div>
      <span class="nav-title">Preview: ${title}</span>
    </div>
    <div class="navbar-right">
      <button class="nbtn nbtn-print" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Cetak / PDF
      </button>
      <button class="nbtn nbtn-close" onclick="window.close()">Tutup</button>
    </div>
  </nav>
  <div class="page-wrap">
    <div class="paper">
      ${innerContent}
    </div>
  </div>
</body>
</html>`;

    // Use Blob URL — reliable for large HTML content unlike document.write()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handlePrintVoucher = (journal: JournalEntry) => {
    setPrintingJournal(journal);
    // Preview shown; user clicks Cetak / PDF to open in new tab
  };

  const handlePrintVoucherNewTab = () => {
    if (!voucherRef.current) return;
    const title = `Bukti Jurnal - ${printingJournal?.referenceNumber || ''}`;
    openPrintTab(voucherRef.current.innerHTML, title);
  };

  const handlePrintJournalListNewTab = () => {
    if (!journalListRef.current) return;
    openPrintTab(journalListRef.current.innerHTML, 'Daftar Jurnal Transaksi');
  };

  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  const filteredAccounts = sortedAccounts.filter(acc => acc.code.toLowerCase().includes(accountSearchQuery.toLowerCase()) || acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase()));
  const getAccountHints = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return { debit: '', credit: '' };
    const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
    return isDebitNormal ? { debit: 'Bertambah', credit: 'Berkurang' } : { debit: 'Berkurang', credit: 'Bertambah' };
  };

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat data jurnal...</div>;

  if (view === 'list') {
    const anyModalActive = isPrintingBatch || isJournalListOpen || printingJournal || isImportModalOpen || isSeedModalOpen;

    return (
      <>
      <div className={`space-y-6 pb-20 ${anyModalActive ? 'hidden print:hidden' : ''}`}>
        {/* ... (Main Content: Filter, Header, Table - No Changes) ... */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Jurnal Umum</h2>
            <p className="text-gray-500 text-sm mt-1">Daftar semua transaksi jurnal yang telah tercatat.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleOpenSeedModal} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors shadow-sm">
              <Database className="w-4 h-4" /> Generate Dummy Data
            </button>
             <button onClick={() => setIsJournalListOpen(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm">
              <List className="w-4 h-4" /> Daftar Jurnal
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm">
              <Upload className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => { resetForm(); setView('form'); }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Buat Jurnal Baru
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4 print:hidden">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari No. Bukti atau Keterangan transaksi..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-4 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-max"><Filter className="w-4 h-4" /> Filter Periode:</div>
                <div className="flex items-center gap-2 flex-1 w-full lg:w-auto">
                    <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-full lg:w-auto px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none focus:border-primary-500" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-full lg:w-auto px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none focus:border-primary-500" />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
                    <button onClick={() => applyDatePreset('TODAY')} className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap">Hari Ini</button>
                    <button onClick={() => applyDatePreset('THIS_MONTH')} className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap">Bulan Ini</button>
                    <button onClick={() => applyDatePreset('LAST_MONTH')} className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap">Bulan Lalu</button>
                    <button onClick={() => applyDatePreset('ALL')} className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap">Semua</button>
                </div>
            </div>
        </div>

        {isSuperAdmin && filteredJournals.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 print:hidden">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filteredJournals.length}
                        ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredJournals.length; }}
                        onChange={toggleSelectAllJournals}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    Pilih Semua
                </label>
                {selectedIds.size > 0 && (
                    <>
                        <span className="text-sm text-gray-500">{selectedIds.size} jurnal dipilih</span>
                        <button
                            onClick={handleBulkDelete}
                            className="ml-auto flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 px-4 py-1.5 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Trash2 className="w-4 h-4" /> Hapus Terpilih ({selectedIds.size})
                        </button>
                    </>
                )}
            </div>
        )}

        <div className="space-y-4 print:hidden">
            {filteredJournals.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-gray-400" /></div>
                    <h3 className="text-lg font-medium text-gray-900">Belum ada transaksi</h3>
                    <p className="text-gray-500 mt-1">Mulai catat transaksi keuangan perusahaan Anda atau import dari Excel.</p>
                </div>
            ) : (
                filteredJournals.map(journal => {
                    const summary = getJournalSummary(journal.lines);
                    return (
                        <div key={journal.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${selectedIds.has(journal.id) ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {isSuperAdmin && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(journal.id)}
                                            onChange={() => toggleSelectJournal(journal.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                            title="Pilih untuk hapus massal"
                                        />
                                    )}
                                    <div className="text-center bg-white border border-gray-200 rounded px-2 py-1">
                                        <span className="block text-xs font-bold text-gray-500 uppercase">{new Date(journal.transactionDate).toLocaleString('id-ID', { month: 'short' })}</span>
                                        <span className="block text-lg font-bold text-gray-900 leading-none">{new Date(journal.transactionDate).getDate()}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-900">{journal.referenceNumber}</h4>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                journal.status === 'POSTED' ? 'bg-green-100 text-green-700 border-green-200' : 
                                                journal.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border-gray-200' : 
                                                'bg-red-100 text-red-700 border-red-200'
                                            }`}>
                                                {journal.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
                                            {typeof summary === 'string' ? (
                                                <span>{summary}</span>
                                            ) : (
                                                <>
                                                    <span className="text-slate-600">{summary.dr}</span>
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                    <span className="text-slate-600">{summary.cr}</span>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{journal.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                                        journal.totalAmount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {formatCurrency(journal.totalAmount)}
                                    </span>
                                    {/* Attachment Button */}
                                    <button
                                        onClick={() => setAttachModalJournal(journal)}
                                        className={`p-1.5 rounded transition relative ${journal.attachment ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                        title={journal.attachment ? `Lampiran: ${journal.attachmentName}` : 'Tambah Lampiran'}
                                    >
                                        <Paperclip className="w-4 h-4" />
                                        {journal.attachment && (
                                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handlePrintVoucher(journal)}
                                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition"
                                        title="Cetak Bukti Jurnal (Voucher)"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(journal)}
                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                        title="Edit Jurnal"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {journal.status !== 'VOID' && (
                                        <button 
                                            onClick={() => handleVoid(journal.id)}
                                            className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition"
                                            title="Void Jurnal"
                                        >
                                            <Ban className="w-4 h-4" />
                                        </button>
                                    )}
                                    {isSuperAdmin && (
                                        <button
                                            onClick={() => handleDelete(journal.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                            title="Hapus Jurnal (Superadmin)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => toggleJournalExpand(journal.id)}
                                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
                                        title={expandedJournals.has(journal.id) ? 'Sembunyikan Detail' : 'Lihat Detail'}
                                    >
                                        {expandedJournals.has(journal.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {expandedJournals.has(journal.id) && (
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-400 border-b border-gray-200 text-xs uppercase">
                                            <th className="text-left py-1 font-semibold w-2/5">Akun</th>
                                            <th className="text-right py-1 font-semibold w-1/5">Debit</th>
                                            <th className="text-right py-1 font-semibold w-1/5">Kredit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {journal.lines.map((line) => (
                                            <tr key={line.id} className="group">
                                                <td className="py-1 pl-2 border-l-2 border-transparent group-hover:border-primary-200">
                                                    <div className={`${line.credit > 0 ? 'pl-4' : ''}`}>
                                                        <span className="font-mono text-gray-400 mr-2 text-[10px]">
                                                            {line.accountName.split(' - ')[0]}
                                                        </span>
                                                        <span className="font-medium text-gray-700 text-xs">
                                                            {line.accountName.split(' - ').slice(1).join(' - ') || line.accountName}
                                                        </span>
                                                        {line.description && (
                                                            <p className="text-[10px] text-gray-400 italic mt-0.5 ml-0">
                                                                {line.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-1 text-right text-gray-600 font-mono text-xs">
                                                    {line.debit > 0 ? formatNumber(line.debit) : '-'}
                                                </td>
                                                <td className="py-1 text-right text-gray-600 font-mono text-xs">
                                                    {line.credit > 0 ? formatNumber(line.credit) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* --- ALL MODALS ARE HERE (SIBLINGS) --- */}
      {/* ... (Import and Seed modals remain unchanged) ... */}
      {isImportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-6 pb-2"><div className="flex items-center gap-3 mb-1"><div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><Upload className="w-5 h-5 text-green-600" /></div><h3 className="text-xl font-bold text-gray-900">Import Excel</h3></div></div>
                    <div className="p-6 pt-4 space-y-5">
                        <div><label className="block text-sm font-semibold text-gray-700 mb-2">Pilih File Excel</label><div className="flex items-center gap-3 px-2 py-2 border border-green-400 rounded-lg cursor-pointer hover:bg-gray-50 transition" onClick={() => fileInputRef.current?.click()}><div className="bg-green-100 text-green-800 px-4 py-2 rounded-md font-medium text-sm">Choose File</div><span className="text-sm text-gray-500 truncate">{importFile ? importFile.name : 'No file chosen'}</span><input type="file" ref={fileInputRef} onChange={handleImportFileChange} onClick={(e: any) => e.target.value = ''} accept=".xlsx, .xls" className="hidden" /></div><p className="text-xs text-gray-400 mt-2">Format kolom Tanggal: dd-mm-yyyy (contoh: 01-01-2025).</p><div className="mt-4 flex justify-center"><button onClick={handleDownloadTemplate} className="text-green-600 text-sm font-medium hover:text-green-700 flex items-center gap-1.5"><Download className="w-4 h-4" /> Unduh Template Excel</button></div></div>
                        {importProgress && (
                          <div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5 text-center">Mengimpor jurnal... {importProgress.done}/{importProgress.total}</p>
                          </div>
                        )}
                        <div className="pt-2 flex justify-end gap-3"><button type="button" disabled={isSaving} onClick={() => { setIsImportModalOpen(false); setImportFile(null); }} className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><X className="w-4 h-4" /> Batal</button><button onClick={handleImportSubmit} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'Mengimpor...' : <><Upload className="w-4 h-4" /> Import</>}</button></div>
                    </div>
                </div>
            </div>
      )}

      {/* ── QUICK ATTACH MODAL (works for any status) ────────────────── */}
      {attachModalJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Paperclip className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Lampiran Bukti Transaksi</h3>
                  <p className="text-xs text-gray-400">{attachModalJournal.referenceNumber} · {attachModalJournal.transactionDate}</p>
                </div>
              </div>
              <button onClick={() => setAttachModalJournal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {attachModalJournal.attachment ? (
                /* Has attachment */
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Paperclip className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{attachModalJournal.attachmentName}</p>
                      <p className="text-xs text-gray-500">Lampiran terlampir</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewAttachment({ data: attachModalJournal.attachment!, name: attachModalJournal.attachmentName! })}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" /> Lihat
                    </button>
                    <button
                      onClick={() => quickAttachInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={isAttaching}
                    >
                      <Upload className="w-4 h-4" /> Ganti
                    </button>
                    <button
                      onClick={handleQuickRemoveAttachment}
                      disabled={isAttaching}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                      title="Hapus lampiran"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* No attachment */
                <div
                  onClick={() => quickAttachInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group"
                >
                  <div className="w-12 h-12 bg-gray-100 group-hover:bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors">
                    <Paperclip className="w-6 h-6 text-gray-400 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Klik untuk upload lampiran</p>
                  <p className="text-xs text-gray-400">JPG, PNG, PDF — Maks. 3MB</p>
                </div>
              )}
              {isAttaching && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
                  Menyimpan lampiran...
                </div>
              )}
            </div>
            <input
              ref={quickAttachInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleQuickAttachChange}
            />
          </div>
        </div>
      )}

      {/* ── ATTACHMENT PREVIEW MODAL ─────────────────────────────── */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-800 text-sm truncate max-w-xs">{previewAttachment.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.data}
                  download={previewAttachment.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={() => setPreviewAttachment(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 min-h-[400px]">
              {previewAttachment.data.startsWith('data:image') ? (
                <img
                  src={previewAttachment.data}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              ) : previewAttachment.data.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewAttachment.data}
                  title={previewAttachment.name}
                  className="w-full h-[600px] rounded-lg"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Preview tidak tersedia untuk tipe file ini.</p>
                  <a href={previewAttachment.data} download={previewAttachment.name} className="text-primary-600 underline mt-2 inline-block text-sm">Download file</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSeedModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center"><h3 className="font-bold text-indigo-900">Generate Data Dummy</h3><button onClick={() => setIsSeedModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
                    <div className="p-6"><p className="text-sm text-gray-600 mb-4">Sistem akan membuat +/- 20 transaksi jurnal otomatis (Kas, Pendapatan, Beban, AJP) untuk bulan yang dipilih.</p><div className="mb-4"><label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Periode</label><input type="month" value={seedMonth} onChange={(e) => setSeedMonth(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"/></div><div className="flex justify-end gap-3 pt-2"><button onClick={() => setIsSeedModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50">Batal</button><button onClick={executeSeedData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2"><Database className="w-4 h-4" /> Generate</button></div></div>
                </div>
            </div>
      )}

      {isJournalListOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto">
            <div className="sticky top-0 z-10 bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shadow-md">
                <div><h2 className="text-lg font-bold">Daftar Jurnal Transaksi</h2><p className="text-xs text-slate-300">Periode: {filterStartDate ? formatDateIndo(filterStartDate) : 'Awal'} s/d {filterEndDate ? formatDateIndo(filterEndDate) : 'Akhir'}</p></div>
                <div className="flex gap-3"><button onClick={handlePrintJournalListNewTab} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded text-sm font-bold flex gap-2 items-center"><Printer className="w-4 h-4" /> Cetak di Tab Baru</button><button onClick={() => setIsJournalListOpen(false)} className="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded text-sm font-bold flex gap-2 items-center"><X className="w-4 h-4" /> Tutup</button></div>
            </div>
            <div ref={journalListRef} className="max-w-[215mm] mx-auto bg-white px-10 pt-8 pb-10 min-h-screen">
                 {/* KOP SURAT */}
                 <div className="border-b-2 border-slate-800 pb-4 mb-5">
                    <div className={`flex items-center ${companyProfile?.logoUrl ? 'gap-3' : 'justify-center'}`}>
                        {companyProfile?.logoUrl && (<img src={companyProfile.logoUrl} alt="Logo" className="object-contain flex-shrink-0" style={{height:'48px',width:'48px',objectFit:'contain',flexShrink:0}} />)}
                        <div className={companyProfile?.logoUrl ? 'text-left' : 'text-center'}>
                            <h1 className="text-base font-bold uppercase tracking-wider">{companyProfile?.name || 'ACCESSTANSI CORP'}</h1>
                            <p className="text-[10px] text-slate-600 leading-tight">{companyProfile ? `${companyProfile.address}${companyProfile.city ? ', ' + companyProfile.city : ''}` : ''}</p>
                            {(companyProfile?.phone || companyProfile?.email) && (<p className="text-[10px] text-slate-500">{companyProfile.phone && `Tel: ${companyProfile.phone}`}{companyProfile.phone && companyProfile.email && ' | '}{companyProfile.email && `Email: ${companyProfile.email}`}</p>)}
                        </div>
                    </div>
                    <div className="text-center mt-3">
                        <h2 className="text-sm font-bold uppercase underline decoration-2 underline-offset-4 tracking-wide">JURNAL UMUM</h2>
                        <p className="mt-1 text-slate-600 font-medium text-[11px]">Periode: {filterStartDate ? formatDateIndo(filterStartDate) : 'Semua Data'} s/d {filterEndDate ? formatDateIndo(filterEndDate) : 'Hari Ini'}</p>
                    </div>
                 </div>

                 {/* TABEL JURNAL UMUM — satu baris per akun */}
                 <table className="w-full border-collapse text-[11px]">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            <th className="border border-slate-600 px-2 py-1 text-center w-16 font-semibold">Tanggal</th>
                            <th className="border border-slate-600 px-2 py-1 text-left w-24 font-semibold">No. Bukti</th>
                            <th className="border border-slate-600 px-2 py-1 text-left w-20 font-semibold">Ref</th>
                            <th className="border border-slate-600 px-2 py-1 text-left font-semibold">Nama Akun / Keterangan</th>
                            <th className="border border-slate-600 px-2 py-1 text-right w-28 font-semibold">Debit</th>
                            <th className="border border-slate-600 px-2 py-1 text-right w-28 font-semibold">Kredit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredJournals.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-6 text-slate-400 italic text-xs">Tidak ada data transaksi pada periode ini.</td></tr>
                        )}
                        {filteredJournals.map((journal, jIdx) => (
                            journal.lines.map((line, lIdx) => {
                                const isFirst = lIdx === 0;
                                const isDebit = line.debit > 0;
                                const rawCode = line.accountName.split(' - ')[0];
                                const accName = line.accountName.split(' - ').slice(1).join(' - ') || line.accountName;
                                return (
                                    <tr key={`${journal.id}-${lIdx}`} className={jIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                        <td className="border-l border-r border-b border-slate-200 px-2 py-[2px] text-center align-top text-slate-500 whitespace-nowrap">
                                            {isFirst ? formatDateShort(journal.transactionDate) : ''}
                                        </td>
                                        <td className="border-r border-b border-slate-200 px-2 py-[2px] font-mono align-top text-slate-700">
                                            {isFirst ? journal.referenceNumber : ''}
                                        </td>
                                        <td className="border-r border-b border-slate-200 px-2 py-[2px] font-mono align-middle text-slate-600">
                                            {formatAccountCode(rawCode)}
                                        </td>
                                        <td className="border-r border-b border-slate-200 px-2 py-[2px] align-middle">
                                            <span className={isDebit ? 'text-slate-800 font-medium' : 'text-slate-600 pl-4 italic'}>
                                                {accName}
                                            </span>
                                            {isFirst && journal.description && (
                                                <span className="text-[9px] text-slate-400 ml-1">— {journal.description}</span>
                                            )}
                                        </td>
                                        <td className="border-r border-b border-slate-200 px-2 py-[2px] text-right font-mono text-slate-800">
                                            {line.debit > 0 ? formatNumberOnly(line.debit) : ''}
                                        </td>
                                        <td className="border-r border-b border-slate-200 px-2 py-[2px] text-right font-mono text-slate-800">
                                            {line.credit > 0 ? formatNumberOnly(line.credit) : ''}
                                        </td>
                                    </tr>
                                );
                            })
                        ))}
                    </tbody>
                    {filteredJournals.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-800 text-slate-800 font-bold text-[11px]">
                                <td colSpan={4} className="border border-slate-600 px-2 py-1 text-right uppercase tracking-wide">Total</td>
                                <td className="border border-slate-600 px-2 py-1 text-right font-mono">{formatNumberOnly(filteredJournals.reduce((s, j) => s + j.totalAmount, 0))}</td>
                                <td className="border border-slate-600 px-2 py-1 text-right font-mono">{formatNumberOnly(filteredJournals.reduce((s, j) => s + j.totalAmount, 0))}</td>
                            </tr>
                        </tfoot>
                    )}
                 </table>

                 <div className="flex justify-end gap-16 mt-14"><div className="text-center w-44"><p className="mb-16 text-slate-600 text-[10px]">Dibuat Oleh:</p><p className="text-xs font-bold border-b border-slate-800 pb-0.5">Admin Keuangan</p></div><div className="text-center w-44"><p className="mb-16 text-slate-600 text-[10px]">Diperiksa Oleh:</p><p className="text-xs font-bold border-b border-slate-800 pb-0.5">Manajer Akuntansi</p></div></div>
            </div>
        </div>
      )}

      {/* --- SINGLE VOUCHER PRINT MODAL (HARMONIZED HEADER) --- */}
      {printingJournal && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto print:block">
            <div ref={voucherRef} className="max-w-[210mm] mx-auto p-12 min-h-screen flex flex-col">
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                    <div className="flex items-start gap-4">
                         {companyProfile?.logoUrl ? (
                            <img src={companyProfile.logoUrl} alt="Logo" className="object-contain" style={{height:'64px',width:'64px',objectFit:'contain'}} />
                        ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200">
                                <Building className="w-8 h-8" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">{companyProfile?.name || 'ACCESSTANSI CORP'}</h1>
                            <p className="text-sm text-slate-600 mt-1 max-w-[300px] leading-snug">{companyProfile ? `${companyProfile.address}${companyProfile.city ? ', '+companyProfile.city:''}` : 'Jl. Sudirman No. 1, Jakarta'}</p>
                            {(companyProfile?.phone || companyProfile?.email) && (<p className="text-xs text-slate-500 mt-1">{companyProfile.phone && `Tel: ${companyProfile.phone}`}{companyProfile.phone && companyProfile.email && ' | '}{companyProfile.email && `Email: ${companyProfile.email}`}</p>)}
                        </div>
                    </div>
                    <div className="text-right"><h2 className="text-3xl font-bold uppercase text-slate-800 tracking-tight">Bukti Jurnal</h2><div className="mt-2 inline-block bg-slate-100 px-3 py-1 rounded border border-slate-300"><span className="font-mono text-xl font-bold text-slate-900">{printingJournal.referenceNumber}</span></div><p className="text-sm text-slate-500 mt-1">Tanggal: {formatDateIndo(printingJournal.transactionDate)}</p></div>
                </div>
                <div className="mb-4"><p className="text-xs text-slate-500 font-bold uppercase mb-1">Keterangan Transaksi:</p><div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-slate-800 text-sm italic">{printingJournal.description}</div></div>
                <table className="w-full text-xs border-collapse mb-6">
                  <thead>
                    <tr className="border-y-2 border-slate-800">
                      <th className="px-3 py-1 text-left w-32 text-[11px] font-bold text-slate-800 tracking-wide">Nomor Akun</th>
                      <th className="px-3 py-1 text-left text-[11px] font-bold text-slate-800 tracking-wide">Nama Akun</th>
                      <th className="px-3 py-1 text-right w-36 text-[11px] font-bold text-slate-800 tracking-wide">Debit</th>
                      <th className="px-3 py-1 text-right w-36 text-[11px] font-bold text-slate-800 tracking-wide">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Kelompokkan baris berdasarkan 5 digit pertama kode akun
                      const groups: Record<string, typeof printingJournal.lines> = {};
                      const order: string[] = [];
                      printingJournal.lines.forEach(line => {
                        const code = line.accountName.split(' - ')[0].replace(/\D/g, '');
                        const prefix = code.slice(0, 5);
                        if (!groups[prefix]) { groups[prefix] = []; order.push(prefix); }
                        groups[prefix].push(line);
                      });
                      // Format kode parent: 11102 → 111-02
                      const fmtParent = (p: string) => p.length <= 3 ? p : `${p.slice(0,3)}-${p.slice(3)}`;
                      // Lookup nama akun parent dari COA (accountsByCode)
                      // Strategi: prefix 5 digit → cari kode header = prefix + "000" (8 digit)
                      // Contoh: prefix "11102" → cari "11102000" → "Bank"
                      const getGroupName = (prefix: string): string => {
                        // Level 5 (prefix 5 digit): cari "xxxxx000"
                        const code8 = (prefix + '00000000').slice(0, 8);
                        const found = accountsByCode.get(code8);
                        if (found) return found;
                        // Level 4 (prefix 4 digit): cari "xxxx0000"
                        const code8b = (prefix.slice(0, 4) + '00000000').slice(0, 8);
                        const found2 = accountsByCode.get(code8b);
                        if (found2) return found2;
                        // Fallback: cari akun yang kodenya persis = prefix + nol sampai 8 digit
                        for (let len = 8; len >= prefix.length + 1; len--) {
                          const padded = (prefix + '00000000').slice(0, len);
                          const hit = accountsByCode.get(padded);
                          if (hit) return hit;
                        }
                        return '';
                      };
                      return order.map(prefix => {
                        const lines = groups[prefix];
                        const gDebit  = lines.reduce((s, l) => s + l.debit, 0);
                        const gCredit = lines.reduce((s, l) => s + l.credit, 0);
                        const gName   = getGroupName(prefix);
                        return (
                          <React.Fragment key={prefix}>
                            {/* Baris kode grup (parent) */}
                            <tr className="bg-slate-100 border-t border-b border-slate-300">
                              <td className="px-3 py-[3px] font-mono font-bold text-slate-800 text-[11px]">{fmtParent(prefix)}</td>
                              <td className="px-3 py-[3px] font-semibold text-slate-700 text-[11px]">{gName}</td>
                              <td className="px-3 py-[3px] text-right font-mono font-bold text-slate-800 text-[11px]">{gDebit  > 0 ? formatNumberOnly(gDebit)  : '0'}</td>
                              <td className="px-3 py-[3px] text-right font-mono font-bold text-slate-800 text-[11px]">{gCredit > 0 ? formatNumberOnly(gCredit) : '0'}</td>
                            </tr>
                            {/* Baris detail child dengan (D)/(K) */}
                            {lines.map((line, idx) => {
                              const isDebit  = line.debit > 0;
                              const rawCode  = line.accountName.split(' - ')[0];
                              const accName  = line.accountName.split(' - ').slice(1).join(' - ') || line.accountName;
                              return (
                                <tr key={idx} className="border-b border-slate-100 bg-white">
                                  <td className="px-3 py-[2px] font-mono text-slate-500 text-[11px] pl-6">{formatAccountCode(rawCode)}</td>
                                  <td className="px-3 py-[2px] text-[11px]">
                                    <span className="font-bold text-[10px] text-slate-500 mr-1.5">{isDebit ? '(D)' : '(K)'}</span>
                                    <span className="text-slate-800">{accName}</span>
                                  </td>
                                  <td className="px-3 py-[2px] text-right font-mono text-slate-800 text-[11px]">{line.debit  > 0 ? formatNumberOnly(line.debit)  : ''}</td>
                                  <td className="px-3 py-[2px] text-right font-mono text-slate-800 text-[11px]">{line.credit > 0 ? formatNumberOnly(line.credit) : ''}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white font-bold border-t-2 border-slate-800">
                      <td colSpan={2} className="px-3 py-1.5 text-right uppercase tracking-wider text-[11px]">TOTAL</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11px]">{formatNumberOnly(printingJournal.totalAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11px]">{formatNumberOnly(printingJournal.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
                <div className="mt-auto grid grid-cols-3 gap-4"><div className="text-center border border-slate-300 h-24 flex flex-col justify-between p-2"><span className="text-xs font-bold text-slate-500">Dibuat Oleh</span><span className="text-xs text-slate-400">Admin / Staff</span></div><div className="text-center border border-slate-300 h-24 flex flex-col justify-between p-2"><span className="text-xs font-bold text-slate-500">Diperiksa Oleh</span><span className="text-xs text-slate-400">Manajer</span></div><div className="text-center border border-slate-300 h-24 flex flex-col justify-between p-2"><span className="text-xs font-bold text-slate-500">Disetujui Oleh</span><span className="text-xs text-slate-400">Direktur</span></div></div>                
            </div>
            <div className="fixed top-4 right-4 print:hidden flex gap-2">
              <button onClick={handlePrintVoucherNewTab} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded shadow font-bold flex items-center gap-2"><Printer className="w-4 h-4"/> Cetak / PDF</button>
              <button onClick={() => setPrintingJournal(null)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow font-bold flex items-center gap-2"><X className="w-4 h-4"/> Tutup Preview</button>
            </div>
        </div>
      )}
      </>
    );
  } else {
    // --- VIEW: FORM ---
    return (
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center gap-4 mb-6"><button onClick={() => { resetForm(); setView('list'); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-600" /></button><div><h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Edit Jurnal' : 'Input Jurnal Baru'}</h2><p className="text-sm text-gray-500">Pastikan Total Debit dan Kredit seimbang.</p></div></div>
        {formError && (<div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-fade-in-up"><AlertCircle className="w-5 h-5 mt-0.5 shrink-0" /><div><h4 className="font-bold">Gagal Menyimpan Jurnal</h4><p className="text-sm mt-1">{formError}</p></div></div>)}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal Transaksi</label><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"/></div><div><label className="block text-sm font-semibold text-gray-700 mb-1.5">No. Bukti / Referensi <span className="text-red-500">*</span></label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Contoh: JV-2023-001" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"/></div><div className="md:col-span-2 flex gap-4"><div className="flex-1"><label className="block text-sm font-semibold text-gray-700 mb-1.5">Keterangan / Deskripsi <span className="text-red-500">*</span></label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Pembayaran Gaji Karyawan Bulan Januari" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"/></div><div className="w-48"><label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label><select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"><option value="POSTED">Posted</option><option value="DRAFT">Draft</option><option value="VOID">Void</option></select></div></div></div>
          {/* ── Attachment Section in Form ── */}
          <div className="px-6 py-4 border-b border-gray-100 bg-white">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-400" /> Lampiran Bukti Transaksi
              <span className="text-xs font-normal text-gray-400 ml-1">Opsional — JPG, PNG, PDF maks. 3MB</span>
            </label>
            {formAttachment ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4 text-amber-600" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{formAttachmentName}</span>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment({ data: formAttachment, name: formAttachmentName! })}
                  className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                  title="Lihat lampiran"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => attachFileInputRef.current?.click()}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Ganti lampiran"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setFormAttachment(null); setFormAttachmentName(null); }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus lampiran"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => attachFileInputRef.current?.click()}
                className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group"
              >
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-amber-100 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                  <Paperclip className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                </div>
                <span className="text-sm text-gray-400 group-hover:text-amber-600 transition-colors">Klik untuk upload bukti transaksi...</span>
              </div>
            )}
            <input
              ref={attachFileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFormAttachmentChange}
            />
          </div>

          <div className="p-6"><h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Rincian Akun</h3><div className="space-y-3"><div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 px-2"><div className="col-span-5">AKUN & KONTAK</div><div className="col-span-3 text-right">DEBIT</div><div className="col-span-3 text-right">KREDIT</div><div className="col-span-1"></div></div>{lines.map((line, index) => { const hints = getAccountHints(line.accountId); const accCode = line.accountName.split(' - ')[0]; const contactType = isContactRequired(accCode); return (<div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-gray-50 p-3 rounded-lg border border-gray-100"><div className="md:col-span-5 space-y-2"><div className="relative"><input type="text" value={line.accountName} onChange={(e) => handleAccountInputChange(index, e.target.value)} onDoubleClick={() => handleOpenAccountModal(index)} onKeyDown={(e) => handleInputKeyDown(e, index)} placeholder="Ketik nama akun atau Klik 2x..." className={`w-full px-3 py-2 border rounded-md text-sm outline-none font-medium ${!line.accountId ? 'border-orange-300 focus:border-orange-500 bg-orange-50' : 'border-gray-300 focus:border-primary-500 bg-white'}`}/>{focusedLineIndex === index && line.accountName && !line.accountId && (<div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">{getSuggestions(line.accountName).map((suggestion, sIdx) => (<div key={suggestion.id} onMouseDown={() => handleSelectAccount(index, suggestion)} className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${sIdx === highlightedIndex ? 'bg-primary-50 text-primary-700' : ''}`}><span className="font-mono font-bold mr-2 text-primary-600">{suggestion.code}</span>{suggestion.name}</div>))}{getSuggestions(line.accountName).length === 0 && (<div className="px-3 py-2 text-sm text-gray-400">Tidak ditemukan</div>)}</div>)}</div>{contactType && line.accountId && (
  <div className="flex items-center gap-2 animate-fade-in-down">
    <Users className="w-4 h-4 text-blue-500" />
    <select 
      value={line.contactId || ''} 
      onChange={(e) => handleContactChange(index, e.target.value)} 
      className="flex-1 text-xs border border-blue-300 bg-blue-50 rounded px-2 py-1.5 text-blue-800 outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">-- Pilih {contactType === 'CUSTOMER' ? 'Pelanggan' : 'Vendor'} (Opsional) --</option>
      {getContactsByType(contactType).map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  </div>
)}
<div className="animate-fade-in-down">
  <input 
    type="text" 
    value={line.description || ''} 
    onChange={(e) => handleLineDescriptionChange(index, e.target.value)} 
    placeholder="Keterangan baris (Opsional)..." 
    className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-[11px] text-gray-600 outline-none focus:border-primary-400 bg-white italic"
  />
</div></div><div className="md:col-span-3"><label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Debit</label><div className="relative"><input type="text" value={lineInputs[index].debit} onChange={(e) => handleAmountChange(index, 'debit', e.target.value)} placeholder="0" className="w-full text-right px-3 py-2 border border-gray-300 rounded-md text-sm font-mono outline-none focus:border-primary-500"/></div>{line.accountId && hints.debit && (<span className="text-[10px] text-red-500 font-medium text-right block mt-1">{hints.debit}</span>)}</div><div className="md:col-span-3"><label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Kredit</label><div className="relative"><input type="text" value={lineInputs[index].credit} onChange={(e) => handleAmountChange(index, 'credit', e.target.value)} placeholder="0" className="w-full text-right px-3 py-2 border border-gray-300 rounded-md text-sm font-mono outline-none focus:border-primary-500"/></div>{line.accountId && hints.credit && (<span className="text-[10px] text-red-500 font-medium text-right block mt-1">{hints.credit}</span>)}</div><div className="md:col-span-1 flex justify-end pt-2 md:pt-0"><button onClick={() => handleRemoveLine(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Hapus Baris"><Trash2 className="w-4 h-4" /></button></div></div>)})} <button onClick={handleAddLine} className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"><Plus className="w-4 h-4" /> Tambah Baris</button></div></div>
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200"><div className="flex flex-col md:flex-row justify-end items-center gap-6 md:gap-12"><div className="text-right"><p className="text-xs font-bold text-gray-500 uppercase">Total Debit</p><p className="text-lg font-mono font-bold text-gray-800">{formatCurrency(totalDebit)}</p></div><div className="text-right"><p className="text-xs font-bold text-gray-500 uppercase">Total Kredit</p><p className="text-lg font-mono font-bold text-gray-800">{formatCurrency(totalCredit)}</p></div><div className="text-right pl-6 border-l border-gray-300"><p className="text-xs font-bold text-gray-500 uppercase">Balance Check</p><div className={`flex items-center gap-2 ${isBalanced ? 'text-green-600' : 'text-red-500'}`}>{isBalanced ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}<span className="font-bold">{isBalanced ? 'Seimbang' : 'Tidak Seimbang'}</span></div></div></div></div>
          <div className="p-6 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => { resetForm(); setView('list'); }} className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Batal</button><button onClick={handleSubmit} disabled={!isBalanced || isSaving} className={`px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm flex items-center gap-2 ${isBalanced && !isSaving ? 'bg-primary-500 hover:bg-primary-600' : 'bg-gray-300 cursor-not-allowed'}`}><Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Jurnal'}</button></div>
        </div>
        {isAccountModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 backdrop-blur-sm">
                 <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up relative">
                     {isQuickAddOpen && (
                         <div className="absolute inset-0 z-[60] bg-white flex flex-col animate-fade-in-up">
                             <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-green-50"><h3 className="font-bold text-green-800">Tambah Akun Cepat</h3><button onClick={() => setIsQuickAddOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
                             <div className="p-6 flex-1"><p className="text-sm text-gray-500 mb-4">Akun akan otomatis dideteksi Level & Kategorinya berdasarkan kode.</p><form onSubmit={handleQuickAddSubmit} className="space-y-4"><div><label className="block text-sm font-semibold text-gray-700 mb-1">Kode Akun (8 Digit)</label><input autoFocus type="text" maxLength={8} value={quickForm.code} onChange={e => setQuickForm({...quickForm, code: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-green-500 font-mono" placeholder="Contoh: 51101009"/><div className="flex justify-between mt-1 text-xs text-gray-400"><span>Format: {formatAccountCode(quickForm.code)}</span><span>{detectAccountAttributes(quickForm.code).type}</span></div></div><div><label className="block text-sm font-semibold text-gray-700 mb-1">Nama Akun</label><input type="text" value={quickForm.name} onChange={e => setQuickForm({...quickForm, name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-green-500" placeholder="Contoh: Beban Lembur"/></div><div className="pt-4"><button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg">Simpan & Pilih</button></div></form></div>
                         </div>
                     )}
                     <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-lg text-gray-900">Pilih Akun</h3><button onClick={() => setIsAccountModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
                     <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input ref={searchInputRef} type="text" value={accountSearchQuery} onChange={(e) => setAccountSearchQuery(e.target.value)} placeholder="Cari kode atau nama akun..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-500"/></div><button onClick={() => setIsQuickAddOpen(true)} className="px-3 py-2 bg-white border border-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1" title="Tambah Akun Baru"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Baru</span></button></div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-1">{filteredAccounts.length > 0 ? filteredAccounts.map(acc => (<div key={acc.id} onClick={() => handleSelectAccount(activeLineIndex, acc)} className="px-4 py-3 hover:bg-primary-50 rounded-lg cursor-pointer group transition-colors flex justify-between items-center"><div><span className="font-mono font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded text-xs mr-2 border border-primary-100">{formatAccountCode(acc.code)}</span><span className="font-medium text-gray-700 group-hover:text-primary-800">{acc.name}</span></div><span className="text-xs text-gray-400 font-medium border border-gray-100 px-2 py-1 rounded bg-white">{getCategoryLabel(acc.type)}</span></div>)) : (<div className="text-center py-8 text-gray-500"><p>Akun tidak ditemukan.</p><button onClick={() => setIsQuickAddOpen(true)} className="text-primary-600 font-bold hover:underline mt-2 text-sm">+ Buat Akun Baru</button></div>)}</div>
                 </div>
             </div>
        )}
      </div>
    );
  }
};