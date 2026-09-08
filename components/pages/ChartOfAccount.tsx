
import React, { useState, useEffect, useRef } from 'react';
import { HierarchicalAccount, AccountType } from '../../types';
import { Plus, Edit2, Trash2, X, Upload, Download, Book, AlertTriangle, CheckCircle, Filter, Search } from 'lucide-react';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import * as XLSX from 'xlsx';
import { useUI } from '../../src/context/UIContext';

// Utility to format 8 digit string to 000-00-000
const formatAccountCode = (code: string): string => {
  const clean = code.replace(/\D/g, '');
  if (clean.length > 8) return clean.slice(0, 8); // Prevent longer than 8 visually
  
  // Format incrementally for better UX
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
};

// --- TEMPLATE DATA SETS ---
const TEMPLATE_JASA: HierarchicalAccount[] = [
  // --- 1. ASET ---
  { id: '10', code: '10000000', name: 'ASET', type: AccountType.ASSET, level: 1, balance: 0, isHeader: true },
  
  // 1.1 Aset Lancar
  { id: '11', code: '11000000', name: 'Aset Lancar', type: AccountType.ASSET, level: 2, balance: 0, isHeader: true },
  
  // 1.1.1 Kas & Setara Kas
  { id: '111', code: '11100000', name: 'Kas & Setara Kas', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: '11101', code: '11101000', name: 'Kas', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1110101', code: '11101001', name: 'Kas Kecil', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: '1110102', code: '11101002', name: 'Kas Besar', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  
  { id: '11102', code: '11102000', name: 'Bank', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1110201', code: '11102001', name: 'Bank BCA', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: '1110202', code: '11102002', name: 'Bank Mandiri', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  // 1.1.2 Piutang
  { id: '112', code: '11200000', name: 'Piutang', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: '11201', code: '11201000', name: 'Piutang Usaha', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1120101', code: '11201001', name: 'Piutang Usaha - IDR', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  
  // 1.1.3 Perlengkapan
  { id: '113', code: '11300000', name: 'Perlengkapan', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: '11301', code: '11301000', name: 'Perlengkapan Kantor', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1130101', code: '11301001', name: 'Stok ATK & Perlengkapan', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  // 1.1.4 Pembayaran Dimuka
  { id: '114', code: '11400000', name: 'Pembayaran Dimuka', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: '11401', code: '11401000', name: 'Sewa Dibayar Dimuka', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1140101', code: '11401001', name: 'Sewa Gedung Dibayar Dimuka', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  // 1.2 Aset Tetap
  { id: '12', code: '12000000', name: 'Aset Tetap', type: AccountType.ASSET, level: 2, balance: 0, isHeader: true },
  
  // 1.2.1 Aset Tetap Berwujud
  { id: '121', code: '12100000', name: 'Aset Tetap Berwujud', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: '12101', code: '12101000', name: 'Peralatan Kantor', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1210101', code: '12101001', name: 'Peralatan Elektronik (PC/Laptop)', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: '1210102', code: '12101002', name: 'Inventaris Furnitur', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  
  { id: '12102', code: '12102000', name: 'Akumulasi Penyusutan', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1210201', code: '12102001', name: 'Akum. Peny. Peralatan Kantor', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  { id: '12103', code: '12103000', name: 'Kendaraan', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1210301', code: '12103001', name: 'Kendaraan Operasional', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: '12104', code: '12104000', name: 'Akumulasi Penyusutan Kendaraan', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: '1210401', code: '12104001', name: 'Akum. Peny. Kendaraan', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  // --- 2. KEWAJIBAN ---
  { id: '20', code: '20000000', name: 'KEWAJIBAN', type: AccountType.LIABILITY, level: 1, balance: 0, isHeader: true },
  
  // 2.1 Kewajiban Jangka Pendek
  { id: '21', code: '21000000', name: 'Kewajiban Jangka Pendek', type: AccountType.LIABILITY, level: 2, balance: 0, isHeader: true },
  
  { id: '211', code: '21100000', name: 'Utang Usaha', type: AccountType.LIABILITY, level: 3, balance: 0, isHeader: true },
  { id: '21101', code: '21101000', name: 'Utang Usaha IDR', type: AccountType.LIABILITY, level: 4, balance: 0, isHeader: true },
  { id: '2110101', code: '21101001', name: 'Utang Vendor', type: AccountType.LIABILITY, level: 5, balance: 0, isHeader: false },
  
  { id: '212', code: '21200000', name: 'Utang Beban (Accrued)', type: AccountType.LIABILITY, level: 3, balance: 0, isHeader: true },
  { id: '21201', code: '21201000', name: 'Utang Gaji', type: AccountType.LIABILITY, level: 4, balance: 0, isHeader: true },
  { id: '2120101', code: '21201001', name: 'Utang Gaji & Tunjangan', type: AccountType.LIABILITY, level: 5, balance: 0, isHeader: false },
  
  { id: '213', code: '21300000', name: 'Utang Pajak', type: AccountType.LIABILITY, level: 3, balance: 0, isHeader: true },
  { id: '21301', code: '21301000', name: 'Utang PPh', type: AccountType.LIABILITY, level: 4, balance: 0, isHeader: true },
  { id: '2130101', code: '21301001', name: 'Utang PPh 21', type: AccountType.LIABILITY, level: 5, balance: 0, isHeader: false },
  { id: '2130102', code: '21301002', name: 'Utang PPh 23', type: AccountType.LIABILITY, level: 5, balance: 0, isHeader: false },

  // 2.2 Kewajiban Jangka Panjang
  { id: '22', code: '22000000', name: 'Kewajiban Jangka Panjang', type: AccountType.LIABILITY, level: 2, balance: 0, isHeader: true },
  { id: '221', code: '22100000', name: 'Utang Bank', type: AccountType.LIABILITY, level: 3, balance: 0, isHeader: true },
  { id: '22101', code: '22101000', name: 'Utang Bank Jangka Panjang', type: AccountType.LIABILITY, level: 4, balance: 0, isHeader: true },
  { id: '2210101', code: '22101001', name: 'Utang Bank Mandiri', type: AccountType.LIABILITY, level: 5, balance: 0, isHeader: false },

  // --- 3. EKUITAS ---
  { id: '30', code: '30000000', name: 'EKUITAS', type: AccountType.EQUITY, level: 1, balance: 0, isHeader: true },
  
  { id: '31', code: '31000000', name: 'Ekuitas Pemilik', type: AccountType.EQUITY, level: 2, balance: 0, isHeader: true },
  
  { id: '311', code: '31100000', name: 'Modal Saham', type: AccountType.EQUITY, level: 3, balance: 0, isHeader: true },
  { id: '31101', code: '31101000', name: 'Modal', type: AccountType.EQUITY, level: 4, balance: 0, isHeader: true },
  { id: '3110101', code: '31101001', name: 'Modal Disetor', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },

  { id: '312', code: '31200000', name: 'Prive (Drawings)', type: AccountType.EQUITY, level: 3, balance: 0, isHeader: true },
  { id: '31201', code: '31201000', name: 'Prive Pemilik', type: AccountType.EQUITY, level: 4, balance: 0, isHeader: true },
  { id: '3120101', code: '31201001', name: 'Prive Pemilik', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },

  { id: '313', code: '31300000', name: 'Saldo Laba (Retained Earnings)', type: AccountType.EQUITY, level: 3, balance: 0, isHeader: true },
  { id: '31301', code: '31301000', name: 'Laba Ditahan', type: AccountType.EQUITY, level: 4, balance: 0, isHeader: true },
  { id: '3130101', code: '31301001', name: 'Laba Ditahan Tahun Lalu', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },
  { id: '3130102', code: '31301002', name: 'Laba Tahun Berjalan', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },

  // --- 4. PENDAPATAN ---
  { id: '40', code: '40000000', name: 'PENDAPATAN', type: AccountType.REVENUE, level: 1, balance: 0, isHeader: true },
  
  { id: '41', code: '41000000', name: 'Pendapatan Operasional', type: AccountType.REVENUE, level: 2, balance: 0, isHeader: true },
  { id: '411', code: '41100000', name: 'Pendapatan Jasa', type: AccountType.REVENUE, level: 3, balance: 0, isHeader: true },
  { id: '41101', code: '41101000', name: 'Pendapatan Jasa Konsultasi', type: AccountType.REVENUE, level: 4, balance: 0, isHeader: true },
  { id: '4110101', code: '41101001', name: 'Pendapatan Jasa', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },

  { id: '42', code: '42000000', name: 'Pendapatan Lain-lain', type: AccountType.REVENUE, level: 2, balance: 0, isHeader: true },
  { id: '421', code: '42100000', name: 'Pendapatan Bunga', type: AccountType.REVENUE, level: 3, balance: 0, isHeader: true },
  { id: '42101', code: '42101000', name: 'Pendapatan Bunga Bank', type: AccountType.REVENUE, level: 4, balance: 0, isHeader: true },
  { id: '4210101', code: '42101001', name: 'Pendapatan Bunga Bank', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },

  // --- 5. BEBAN ---
  { id: '50', code: '50000000', name: 'BEBAN', type: AccountType.EXPENSE, level: 1, balance: 0, isHeader: true },
  
  { id: '51', code: '51000000', name: 'Beban Operasional', type: AccountType.EXPENSE, level: 2, balance: 0, isHeader: true },
  
  { id: '511', code: '51100000', name: 'Beban Gaji & Tunjangan', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: '51101', code: '51101000', name: 'Gaji Karyawan', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5110101', code: '51101001', name: 'Beban Gaji Staff', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: '5110102', code: '51101002', name: 'Beban Tunjangan Makan', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  
  { id: '512', code: '51200000', name: 'Beban Kantor & Umum', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: '51201', code: '51201000', name: 'Sewa', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5120101', code: '51201001', name: 'Beban Sewa Kantor', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  
  { id: '51202', code: '51202000', name: 'Utilitas (Listrik, Air, Internet)', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5120201', code: '51202001', name: 'Beban Listrik', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: '5120202', code: '51202002', name: 'Beban Air', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: '5120203', code: '51202003', name: 'Beban Internet', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },

  { id: '513', code: '51300000', name: 'Beban Pemasaran', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: '51301', code: '51301000', name: 'Iklan & Promosi', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5130101', code: '51301001', name: 'Beban Iklan', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },

  { id: '514', code: '51400000', name: 'Beban Penyusutan', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: '51401', code: '51401000', name: 'Penyusutan Aset Tetap', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5140101', code: '51401001', name: 'Beban Peny. Peralatan Kantor', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: '5140102', code: '51401002', name: 'Beban Peny. Kendaraan', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },

  { id: '52', code: '52000000', name: 'Beban Lain-lain', type: AccountType.EXPENSE, level: 2, balance: 0, isHeader: true },
  { id: '521', code: '52100000', name: 'Administrasi Bank', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: '52101', code: '52101000', name: 'Admin Bank', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: '5210101', code: '52101001', name: 'Beban Administrasi Bank', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
];

const TEMPLATE_DAGANG: HierarchicalAccount[] = [
  ...TEMPLATE_JASA.filter(a => !a.code.startsWith('4') && !a.code.startsWith('5')), // Reuse Asset/Liab/Equity
  // Add Inventory to Asset (Insert into appropriate hierarchy if possible, or append)
  // 1.1.5 Persediaan
  { id: 'd1', code: '11300000', name: 'Persediaan', type: AccountType.ASSET, level: 3, balance: 0, isHeader: true },
  { id: 'd1-1', code: '11301000', name: 'Persediaan Barang Dagang', type: AccountType.ASSET, level: 4, balance: 0, isHeader: true },
  { id: 'd1-2', code: '11301001', name: 'Persediaan Barang Dagang', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },

  // PENDAPATAN KHUSUS DAGANG
  { id: 'd2', code: '40000000', name: 'PENDAPATAN', type: AccountType.REVENUE, level: 1, balance: 0, isHeader: true },
  { id: 'd2-1', code: '41000000', name: 'Pendapatan Operasional', type: AccountType.REVENUE, level: 2, balance: 0, isHeader: true },
  { id: 'd2-2', code: '41100000', name: 'Penjualan', type: AccountType.REVENUE, level: 3, balance: 0, isHeader: true },
  { id: 'd2-3', code: '41101000', name: 'Penjualan Barang', type: AccountType.REVENUE, level: 4, balance: 0, isHeader: true },
  { id: 'd3', code: '41101001', name: 'Penjualan Barang Dagang', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
  { id: 'd4', code: '41102001', name: 'Retur Penjualan', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
  { id: 'd5', code: '41103001', name: 'Potongan Penjualan', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
  
  // BEBAN & HPP
  { id: 'd6', code: '50000000', name: 'BEBAN & HPP', type: AccountType.EXPENSE, level: 1, balance: 0, isHeader: true },
  { id: 'd6-1', code: '51000000', name: 'Harga Pokok Penjualan', type: AccountType.EXPENSE, level: 2, balance: 0, isHeader: true },
  { id: 'd6-2', code: '51100000', name: 'HPP', type: AccountType.EXPENSE, level: 3, balance: 0, isHeader: true },
  { id: 'd6-3', code: '51101000', name: 'HPP Barang', type: AccountType.EXPENSE, level: 4, balance: 0, isHeader: true },
  { id: 'd7', code: '51101001', name: 'Harga Pokok Penjualan (HPP)', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  
  { id: 'd8', code: '52000000', name: 'Beban Operasional', type: AccountType.EXPENSE, level: 2, balance: 0, isHeader: true },
  { id: 'd9', code: '52101001', name: 'Beban Gaji', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: 'd10', code: '52102001', name: 'Beban Pemasaran', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
];

const TEMPLATE_MANUFAKTUR: HierarchicalAccount[] = [
  ...TEMPLATE_JASA.filter(a => !a.code.startsWith('112') && !a.code.startsWith('4') && !a.code.startsWith('5')),
  // Inventory Complex
  { id: 'm1', code: '11301001', name: 'Persediaan Bahan Baku', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: 'm2', code: '11302001', name: 'Persediaan Barang Dalam Proses', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: 'm3', code: '11303001', name: 'Persediaan Barang Jadi', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  { id: 'm4', code: '11304001', name: 'Persediaan Bahan Penolong', type: AccountType.ASSET, level: 5, balance: 0, isHeader: false },
  // Revenue
  { id: 'm5', code: '40000000', name: 'PENDAPATAN', type: AccountType.REVENUE, level: 1, balance: 0, isHeader: true },
  { id: 'm6', code: '41101001', name: 'Penjualan Produk Jadi', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
  // Cost of Goods Manufactured
  { id: 'm7', code: '50000000', name: 'BEBAN POKOK PRODUKSI', type: AccountType.EXPENSE, level: 1, balance: 0, isHeader: true },
  { id: 'm8', code: '51101001', name: 'Biaya Bahan Baku', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: 'm9', code: '51102001', name: 'Biaya Tenaga Kerja Langsung', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
  { id: 'm10', code: '51103001', name: 'Biaya Overhead Pabrik (BOP)', type: AccountType.EXPENSE, level: 5, balance: 0, isHeader: false },
];

const TEMPLATE_NIRLABA: HierarchicalAccount[] = [
  ...TEMPLATE_JASA.filter(a => !a.code.startsWith('3') && !a.code.startsWith('4')),
  // Aset Neto (Pengganti Ekuitas ISAK 35)
  { id: 'n1', code: '30000000', name: 'ASET NETO', type: AccountType.EQUITY, level: 1, balance: 0, isHeader: true },
  { id: 'n2', code: '31101001', name: 'Aset Neto Tanpa Pembatasan', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },
  { id: 'n3', code: '31201001', name: 'Aset Neto Dengan Pembatasan', type: AccountType.EQUITY, level: 5, balance: 0, isHeader: false },
  // Penghasilan / Sumbangan
  { id: 'n4', code: '40000000', name: 'PENGHASILAN', type: AccountType.REVENUE, level: 1, balance: 0, isHeader: true },
  { id: 'n5', code: '41101001', name: 'Sumbangan Donatur', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
  { id: 'n6', code: '41102001', name: 'Hibah Pemerintah', type: AccountType.REVENUE, level: 5, balance: 0, isHeader: false },
];


export const ChartOfAccount: React.FC = () => {
  const { toast, confirm } = useUI();
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [editingAccount, setEditingAccount] = useState<HierarchicalAccount | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Conflict Resolution State
  const [importConflict, setImportConflict] = useState<{
    conflicting: HierarchicalAccount[],
    newEntries: HierarchicalAccount[]
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<HierarchicalAccount>>({
    code: '',
    name: '',
    type: AccountType.ASSET,
    level: 5, 
    isHeader: false,
    balance: 0
  });

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<'ALL' | 'NERACA' | 'LABA_RUGI'>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterHead, setFilterHead] = useState<string>('ALL');

  // Load from API on Mount
  useEffect(() => {
    accountsService.getAll()
      .then(data => {
        setAccounts(data);
        setIsLoaded(true);
      })
      .catch(() => toast('Gagal memuat data akun dari server.', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  // Logic to detect attributes based on Code
  const detectAccountAttributes = (code: string) => {
    if (!code || code.length === 0) return { type: AccountType.ASSET, level: 1, isHeader: true };

    const cleanCode = code.padEnd(8, '0'); // Analyze as if full length
    
    // 1. Detect Type based on First Digit
    let type = AccountType.ASSET;
    const firstChar = cleanCode.charAt(0);
    switch(firstChar) {
      case '1': type = AccountType.ASSET; break;
      case '2': type = AccountType.LIABILITY; break;
      case '3': type = AccountType.EQUITY; break;
      case '4': type = AccountType.REVENUE; break;
      case '5': type = AccountType.EXPENSE; break;
      case '6': type = AccountType.EXPENSE; break;
      case '7': type = AccountType.REVENUE; break;
      case '8': type = AccountType.EXPENSE; break;
      case '9': type = AccountType.EXPENSE; break;
      default: type = AccountType.ASSET;
    }

    // 2. Detect Level based on Non-Zero Positions
    let level = 1;
    let isHeader = true;

    // Check from deepest level upwards
    const d2 = cleanCode.charAt(1);
    const d3 = cleanCode.charAt(2);
    const d45 = cleanCode.substring(3, 5);
    const d678 = cleanCode.substring(5, 8);

    if (d678 !== '000') {
      level = 5;
      isHeader = false; // Level 5 is Transaction/Detail
    } else if (d45 !== '00') {
      level = 4;
      isHeader = true;
    } else if (d3 !== '0') {
      level = 3;
      isHeader = true;
    } else if (d2 !== '0') {
      level = 2;
      isHeader = true;
    } else {
      level = 1;
      isHeader = true;
    }

    return { type, level, isHeader };
  };

  const handleOpenModal = (account?: HierarchicalAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData(account);
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type: AccountType.ASSET,
        level: 1,
        isHeader: true,
        balance: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const accountToDelete = accounts.find(a => a.id === id);
    if (!accountToDelete) return;

    // Check Hierarchy (Prevent deleting headers with children)
    const hasChildren = accounts.some(a => a.id !== id && a.code.startsWith(accountToDelete.code) && a.code !== accountToDelete.code);
    if (hasChildren) {
        toast(`Gagal menghapus: Akun "${accountToDelete.name}" memiliki sub-akun. Silakan hapus sub-akun terlebih dahulu.`, 'error');
        return;
    }

    const confirmMsg = accountToDelete.balance !== 0
        ? `Akun "${accountToDelete.name}" memiliki saldo ${accountToDelete.balance}. Menghapusnya akan mengubah keseimbangan neraca. Lanjutkan?`
        : `Apakah Anda yakin ingin menghapus akun "${accountToDelete.name}"?`;

    if (!await confirm(confirmMsg, { title: 'Hapus Akun', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;

    try {
      await accountsService.delete(id);
      setAccounts(prev => prev.filter(acc => acc.id !== id));
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus akun.', 'error');
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 8);
    const { type, level, isHeader } = detectAccountAttributes(rawVal);
    
    setFormData({
      ...formData,
      code: rawVal,
      type,
      level,
      isHeader
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || formData.code.length !== 8) {
      toast("Kode Akun harus terdiri dari 8 digit angka.", 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAccount) {
        const updated = await accountsService.update(editingAccount.id, {
          code: formData.code!,
          name: formData.name!,
          type: formData.type!,
          level: Number(formData.level),
          isHeader: formData.isHeader || false,
          balance: formData.balance || 0,
        });
        setAccounts(prev => prev.map(acc => acc.id === editingAccount.id ? updated : acc));
      } else {
        const created = await accountsService.create({
          code: formData.code!,
          name: formData.name!,
          type: formData.type!,
          level: Number(formData.level),
          isHeader: formData.isHeader || false,
          balance: formData.balance || 0,
        });
        setAccounts(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan akun.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- TEMPLATE LOGIC ---
  const handleApplyTemplate = async (type: 'JASA' | 'DAGANG' | 'MANUFAKTUR' | 'NIRLABA') => {
    const confirmMsg = "PERINGATAN: Tindakan ini akan MENGHAPUS semua daftar akun yang ada saat ini dan menggantinya dengan akun standar template. Apakah Anda yakin ingin melanjutkan?";
    if (!await confirm(confirmMsg, { title: 'Terapkan Template Akun', variant: 'warning', confirmLabel: 'Ya, Terapkan' })) return;

    setIsSaving(true);
    try {
      // Check for existing journals first
      const journals = await journalsService.getAll();
      if (journals.length > 0) {
        toast('Gagal: Terdapat data jurnal yang menggunakan akun. Hapus semua jurnal terlebih dahulu sebelum mengganti template.', 'error');
        return;
      }

      // Delete all existing accounts one by one
      for (const acc of accounts) {
        await accountsService.delete(acc.id);
      }

      // Bulk create template accounts
      let templateAccounts: HierarchicalAccount[] = [];
      switch(type) {
        case 'JASA': templateAccounts = TEMPLATE_JASA; break;
        case 'DAGANG': templateAccounts = TEMPLATE_DAGANG; break;
        case 'MANUFAKTUR': templateAccounts = TEMPLATE_MANUFAKTUR; break;
        case 'NIRLABA': templateAccounts = TEMPLATE_NIRLABA; break;
      }

      const created = await accountsService.bulkCreate(templateAccounts);
      setAccounts(created);
      setIsTemplateModalOpen(false);
      toast(`Berhasil menerapkan template ${type}.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menerapkan template.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsSaving(true);
    try {
      const journals = await journalsService.getAll();
      if (journals.length > 0) {
        toast("Gagal menghapus: Sistem mendeteksi adanya transaksi di Jurnal Umum. Silakan hapus semua jurnal terlebih dahulu sebelum mengosongkan Daftar Akun.", 'error');
        setIsDeleteAllModalOpen(false);
        return;
      }

      // Delete all accounts (leaf nodes first — sort by level descending)
      const sorted = [...accounts].sort((a, b) => b.level - a.level);
      for (const acc of sorted) {
        await accountsService.delete(acc.id);
      }

      setAccounts([]);
      setIsDeleteAllModalOpen(false);
      setConfirmText('');
      toast('Semua akun berhasil dihapus.', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus semua akun.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- IMPORT EXCEL LOGIC ---
  
  const handleDownloadTemplate = () => {
    // SHEET 1: TEMPLATE INPUT
    const templateData = [
        ["Kode Akun", "Nama Akun", "Saldo Awal"],
        ["11101003", "Kas Operasional", 0],
        ["21101002", "Utang Vendor B", 5000000],
        ["NOTE:", "Kode Akun wajib 8 digit angka. Level dan Kategori akan dideteksi otomatis.", ""]
    ];
    const wsTemplate = XLSX.utils.aoa_to_sheet(templateData);

    // SHEET 2: EXISTING ACCOUNTS (REFERENCE)
    // Headers
    const existingData: (string | number)[][] = [
        ["Kode Akun", "Nama Akun", "Kategori", "Level", "Saldo Saat Ini"]
    ];

    // Sort and map existing accounts
    const sortedCurrent = [...accounts].filter(a => a?.code).sort((a, b) => a.code.localeCompare(b.code));
    
    sortedCurrent.forEach(acc => {
        existingData.push([
            acc.code, // Keep raw format 11101001 for easy copy paste
            acc.name,
            acc.type, 
            acc.level,
            acc.balance
        ]);
    });

    const wsExisting = XLSX.utils.aoa_to_sheet(existingData);

    // Create Workbook
    const wb = XLSX.utils.book_new();
    
    // Add Sheets
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Input Akun Baru");
    XLSX.utils.book_append_sheet(wb, wsExisting, "Data Akun Terdaftar");

    // Download
    XLSX.writeFile(wb, "Template_Import_Akun.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast("Silakan pilih file Excel terlebih dahulu.", 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      // Always read the first sheet for Import
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        toast("File Excel kosong atau format salah.", 'error');
        return;
      }

      const timestamp = Date.now();
      const existingCodes = new Set(accounts.map(a => a.code));
      
      const conflicting: HierarchicalAccount[] = [];
      const newEntries: HierarchicalAccount[] = [];

      // Temporary map to handle duplicates within the file itself (last win principle for the file)
      const fileDataMap = new Map<string, HierarchicalAccount>();

      jsonData.forEach((row: any, index) => {
        const codeRaw = row['Kode Akun'] || row['Kode'] || row['Code'];
        const nameRaw = row['Nama Akun'] || row['Nama'] || row['Name'];
        const balanceRaw = row['Saldo Awal'] || row['Saldo'] || row['Balance'] || 0;

        if (codeRaw && nameRaw) {
          const codeStr = String(codeRaw).replace(/\D/g, '').padEnd(8, '0').slice(0,8);
          const { type, level, isHeader } = detectAccountAttributes(codeStr);
          
          const account: HierarchicalAccount = {
            id: `${timestamp}-${index}`,
            code: codeStr,
            name: String(nameRaw),
            type,
            level,
            isHeader,
            balance: Number(balanceRaw)
          };
          
          fileDataMap.set(codeStr, account);
        }
      });

      // Split into conflicts and new
      fileDataMap.forEach((account) => {
          if (existingCodes.has(account.code)) {
              conflicting.push(account);
          } else {
              newEntries.push(account);
          }
      });

      // CHECK FOR CONFLICTS
      if (conflicting.length > 0) {
          setImportConflict({ conflicting, newEntries });
          // Modal will show automatically based on importConflict state
          return;
      }

      // No conflicts? Save immediately via API
      if (newEntries.length > 0) {
        try {
          const created = await accountsService.bulkCreate(newEntries);
          setAccounts(prev => [...prev, ...created]);
        } catch (err: any) {
          toast(err.message || 'Gagal mengimpor akun.', 'error');
          return;
        }
      }
      setIsImportModalOpen(false);
      setImportFile(null);
      toast(`Berhasil mengimpor ${newEntries.length} akun baru.`, 'success');
    };

    reader.readAsBinaryString(importFile);
  };

  const resolveImportConflict = async (strategy: 'SKIP' | 'OVERWRITE') => {
    const currentConflict = importConflict;
    if (!currentConflict) return;

    setIsSaving(true);
    try {
      if (strategy === 'SKIP') {
        if (currentConflict.newEntries.length > 0) {
          const created = await accountsService.bulkCreate(currentConflict.newEntries);
          setAccounts(prev => [...prev, ...created]);
        }
        toast(`Berhasil menambahkan ${currentConflict.newEntries.length} akun. ${currentConflict.conflicting.length} akun duplikat dilewati.`, 'success');
      } else {
        // bulkCreate does upsert by code — handles both overwrite and new
        const allToUpsert = [...currentConflict.conflicting, ...currentConflict.newEntries];
        const upserted = await accountsService.bulkCreate(allToUpsert);
        // Merge into accounts state: update existing, append new
        setAccounts(prev => {
          const map = new Map(prev.map(a => [a.code, a]));
          upserted.forEach(a => map.set(a.code, a));
          return Array.from(map.values());
        });
        toast(`Berhasil memperbarui ${currentConflict.conflicting.length} akun dan menambahkan ${currentConflict.newEntries.length} akun baru.`, 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menyelesaikan import.', 'error');
    } finally {
      setIsSaving(false);
      setImportConflict(null);
      setIsImportModalOpen(false);
      setImportFile(null);
    }
  };

  // Helper for Display
  const getCategoryLabel = (type: AccountType, code?: string) => {
    if (code) {
      const first = code.charAt(0);
      if (first === '6') return 'Beban Ops. Lain (6)';
      if (first === '7') return 'Pendapatan Lain (7)';
      if (first === '8') return 'Beban Lain-lain (8)';
      if (first === '9') return 'Pajak & Luar Biasa (9)';
    }
    switch(type) {
      case AccountType.ASSET: return 'Harta (Asset)';
      case AccountType.LIABILITY: return 'Kewajiban (Liability)';
      case AccountType.EQUITY: return 'Modal (Equity)';
      case AccountType.REVENUE: return 'Pendapatan (Revenue)';
      case AccountType.EXPENSE: return 'Beban (Expense)';
      default: return type;
    }
  };

  const getNormalBalance = (type: AccountType) => {
    if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
      return { label: 'Debit', color: 'bg-emerald-100 text-emerald-700' };
    }
    return { label: 'Kredit', color: 'bg-orange-100 text-orange-700' };
  };

  // Sort and Filter accounts
  const sortedAccounts = [...accounts]
    .filter(acc => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!acc.code.toLowerCase().includes(q) && !acc.name.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Filter by Level
      if (filterLevel !== 'ALL' && acc.level !== Number(filterLevel)) {
        return false;
      }
      
      // Filter by Group
      if (filterGroup === 'NERACA') {
        const first = acc.code.charAt(0);
        if (!['1', '2', '3'].includes(first)) return false;
      }
      if (filterGroup === 'LABA_RUGI') {
        const first = acc.code.charAt(0);
        if (!['4', '5', '6', '7', '8', '9'].includes(first)) return false;
      }

      // Filter by Head (Prefix)
      if (filterHead !== 'ALL') {
        if (!acc.code?.startsWith(filterHead)) return false;
      }

      return true; // Default ALL
    })
    .filter(a => a?.code)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''));

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat data akun...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daftar Akun (Chart of Accounts)</h2>
          <p className="text-gray-500 text-sm mt-1">Struktur hierarki akun 8-digit (Format: 000-00-000).</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <button 
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Book className="w-4 h-4" />
            Template Akun
          </button>
           <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Akun
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* FILTERS TOOLBAR */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center bg-gray-50">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari kode atau nama akun..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 font-semibold min-w-[80px]">
            <Filter className="w-4 h-4" />
            Filter:
          </div>
          <div className="flex gap-4 w-full md:w-auto flex-wrap">
            {/* Filter Kepala (Prefix) */}
            <select 
              value={filterHead} 
              onChange={(e) => setFilterHead(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-40"
            >
              <option value="ALL">Semua Kepala</option>
              <option value="1">1 - Aset</option>
              <option value="2">2 - Kewajiban</option>
              <option value="3">3 - Ekuitas</option>
              <option value="4">4 - Pendapatan</option>
              <option value="5">5 - Beban</option>
              <option value="6">6 - Beban Ops. Lain</option>
              <option value="7">7 - Pendapatan Lain</option>
              <option value="8">8 - Beban Lain-lain</option>
              <option value="9">9 - Pajak & Luar Biasa</option>
            </select>

            <select 
              value={filterGroup} 
              onChange={(e) => setFilterGroup(e.target.value as any)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-48"
            >
              <option value="ALL">Semua Kelompok</option>
              <option value="NERACA">Akun Neraca</option>
              <option value="LABA_RUGI">Akun Laba Rugi</option>
            </select>
            
            <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-32"
            >
              <option value="ALL">Semua Level</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-48">Kode Akun</th>
                <th className="px-6 py-4">Nama Akun</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4 text-center">Level</th>
                <th className="px-6 py-4 text-center">Saldo Normal</th>
                <th className="px-6 py-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedAccounts.length === 0 ? (
                 <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data akun yang sesuai filter.
                  </td>
                </tr>
              ) : (
                sortedAccounts.map((account) => {
                  const normalBalance = getNormalBalance(account.type);
                  return (
                    <tr key={account.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-3 font-mono text-gray-600 font-medium whitespace-nowrap">
                        {formatAccountCode(account.code)}
                      </td>
                      <td className="px-6 py-3">
                        <div 
                          style={{ paddingLeft: `${(account.level - 1) * 20}px` }}
                          className="flex items-center gap-2"
                        >
                          {account.level > 1 && <span className="text-gray-300">└─</span>}
                          <span className={`font-medium ${account.isHeader ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                            {account.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                         {getCategoryLabel(account.type, account.code)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                           {account.level}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide ${normalBalance.color}`}>
                           {normalBalance.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(account)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(account.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="mt-12 p-6 bg-red-50 border border-red-100 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
        </div>
        <p className="text-sm text-red-700 mb-4">
          Tindakan di bawah ini bersifat destruktif dan tidak dapat dibatalkan. Pastikan Anda telah melakukan backup data sebelum melanjutkan.
        </p>
        <button 
          onClick={() => setIsDeleteAllModalOpen(true)}
          className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg transition-all shadow-sm font-semibold"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Semua Akun
        </button>
      </div>

      {/* MODAL TEMPLATE SELECTION */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-fade-in-up">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Gunakan Template Akun</h3>
                        <p className="text-sm text-gray-500">Pilih standar akun yang sesuai dengan jenis usaha Anda.</p>
                    </div>
                    <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* JASA */}
                    <div 
                        onClick={() => handleApplyTemplate('JASA')}
                        className="border border-gray-200 rounded-xl p-5 hover:border-primary-500 hover:shadow-md cursor-pointer transition group"
                    >
                        <h4 className="font-bold text-lg text-gray-800 group-hover:text-primary-600 mb-2">Perusahaan Jasa</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">Template standar untuk konsultan, agensi, salon, bengkel. Fokus pada pendapatan jasa.</p>
                    </div>

                    {/* DAGANG */}
                    <div 
                        onClick={() => handleApplyTemplate('DAGANG')}
                        className="border border-gray-200 rounded-xl p-5 hover:border-primary-500 hover:shadow-md cursor-pointer transition group"
                    >
                        <h4 className="font-bold text-lg text-gray-800 group-hover:text-primary-600 mb-2">Perusahaan Dagang</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">Untuk retail, grosir, toko. Mencakup akun Persediaan Barang Dagang dan Harga Pokok Penjualan (HPP).</p>
                    </div>

                    {/* MANUFAKTUR */}
                    <div 
                        onClick={() => handleApplyTemplate('MANUFAKTUR')}
                        className="border border-gray-200 rounded-xl p-5 hover:border-primary-500 hover:shadow-md cursor-pointer transition group"
                    >
                        <h4 className="font-bold text-lg text-gray-800 group-hover:text-primary-600 mb-2">Perusahaan Manufaktur</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">Sesuai SAK Entitas Privat. Mencakup akun Bahan Baku, Barang Dalam Proses (WIP), Barang Jadi, dan Biaya Pabrikasi.</p>
                    </div>

                    {/* NIRLABA */}
                    <div 
                        onClick={() => handleApplyTemplate('NIRLABA')}
                        className="border border-gray-200 rounded-xl p-5 hover:border-primary-500 hover:shadow-md cursor-pointer transition group"
                    >
                        <h4 className="font-bold text-lg text-gray-800 group-hover:text-primary-600 mb-2">Organisasi Nirlaba (ISAK 35)</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">Yayasan, NGO. Menggunakan istilah Aset Neto (Tanpa/Dengan Pembatasan) dan beban program.</p>
                    </div>
                </div>

                <div className="bg-yellow-50 px-6 py-4 border-t border-yellow-100">
                    <p className="text-sm text-yellow-800 font-medium">
                        Catatan: Menggunakan template akan <span className="underline font-bold">menghapus data akun yang ada</span>. Pastikan Anda belum memiliki transaksi penting.
                    </p>
                </div>
            </div>
        </div>
      )}

      {/* MODAL FORM (SINGLE) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            
            <div className="px-6 py-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Edit2 className="w-5 h-5 text-green-600" />
                 </div>
                 <h3 className="text-xl font-bold text-gray-900">
                  {editingAccount ? 'Edit Akun' : 'Tambah Akun'}
                </h3>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nomor Akun</label>
                <input 
                  type="text" 
                  required
                  maxLength={8}
                  value={formData.code}
                  onChange={handleCodeChange}
                  placeholder="Nomor Akun"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all placeholder-gray-400 font-medium"
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400 font-mono">
                    Preview: {formatAccountCode(formData.code || '')}
                  </p>
                  <p className="text-xs text-primary-600 font-medium">
                     Level {formData.level} • {getCategoryLabel(formData.type as AccountType, formData.code)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Akun</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Nama Akun"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all placeholder-gray-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <div className="w-4 h-4 flex items-center justify-center font-bold">✓</div>
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {isImportModalOpen && !importConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            
            <div className="px-6 py-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-green-600" />
                 </div>
                 <h3 className="text-xl font-bold text-gray-900">
                  Import Excel
                </h3>
              </div>
            </div>
            
            <div className="p-6 pt-4 space-y-5">
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih File Excel</label>
                <div 
                  className="flex items-center gap-3 px-2 py-2 border border-green-400 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md font-medium text-sm">
                        Choose File
                    </div>
                    <span className="text-sm text-gray-500 truncate">
                        {importFile ? importFile.name : 'No file chosen'}
                    </span>
                    <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />
                </div>
                
                <div className="mt-4 flex justify-center">
                    <button 
                        onClick={handleDownloadTemplate}
                        className="text-green-600 text-sm font-medium hover:text-green-700 flex items-center gap-1.5"
                    >
                        <Download className="w-4 h-4" />
                        Unduh Template Excel
                    </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                      setIsImportModalOpen(false);
                      setImportFile(null);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Batal
                </button>
                <button 
                  onClick={handleImportSubmit}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT RESOLUTION MODAL */}
      {importConflict && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                <div className="bg-yellow-50 px-6 py-4 flex items-center gap-3 border-b border-yellow-100">
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    <div>
                        <h3 className="font-bold text-lg text-yellow-800">Duplikasi Data Ditemukan</h3>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Sistem mendeteksi adanya <strong>{importConflict.conflicting.length} akun</strong> dalam file import yang kode akunnya sudah terdaftar di aplikasi.
                    </p>
                    
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm max-h-32 overflow-y-auto font-mono">
                        {importConflict.conflicting.map(c => (
                            <div key={c.code} className="text-gray-600">
                                {c.code} - {c.name}
                            </div>
                        ))}
                    </div>

                    <p className="text-gray-600 text-sm font-medium">Apa yang ingin Anda lakukan terhadap akun duplikat ini?</p>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button 
                            onClick={() => resolveImportConflict('SKIP')}
                            className="flex flex-col items-center justify-center p-4 border-2 border-green-100 hover:border-green-500 hover:bg-green-50 rounded-xl transition group"
                        >
                            <span className="font-bold text-green-700 group-hover:text-green-800 mb-1">Lewati (Skip)</span>
                            <span className="text-xs text-center text-gray-500">
                                Jangan import data duplikat. Hanya tambahkan {importConflict.newEntries.length} akun baru.
                            </span>
                        </button>

                        <button 
                            onClick={() => resolveImportConflict('OVERWRITE')}
                            className="flex flex-col items-center justify-center p-4 border-2 border-orange-100 hover:border-orange-500 hover:bg-orange-50 rounded-xl transition group"
                        >
                            <span className="font-bold text-orange-700 group-hover:text-orange-800 mb-1">Timpa (Overwrite)</span>
                            <span className="text-xs text-center text-gray-500">
                                Update data lama dengan data Excel. Total update: {importConflict.conflicting.length} akun.
                            </span>
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                    <button 
                        onClick={() => {
                            setImportConflict(null);
                            setIsImportModalOpen(false);
                            setImportFile(null);
                        }}
                        className="text-gray-500 text-sm hover:text-gray-700 font-medium"
                    >
                        Batal Import
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* DELETE ALL CONFIRMATION MODAL */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold">Konfirmasi Hapus Semua</h3>
              </div>
              <button onClick={() => setIsDeleteAllModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                <p className="font-bold mb-1">PERINGATAN!</p>
                <p>Tindakan ini akan menghapus seluruh Daftar Akun (COA). Data tidak dapat dikembalikan kecuali Anda memiliki backup Excel.</p>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Untuk melanjutkan, silakan ketik <span className="font-bold text-red-600">HAPUS SEMUA</span> di bawah ini:
              </p>
              
              <input 
                type="text" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik di sini..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-red-500 mb-6"
                autoFocus
              />

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteAll}
                  disabled={confirmText !== 'HAPUS SEMUA'}
                  className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 text-white transition-all ${
                    confirmText === 'HAPUS SEMUA' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Ya, Hapus Semua
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
