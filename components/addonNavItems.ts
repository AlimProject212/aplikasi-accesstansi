import type { ComponentType } from 'react';
import { Package, ClipboardList, Truck, Receipt, Wallet, ClipboardCheck, CheckSquare, ShieldCheck, ShoppingCart } from 'lucide-react';
import { ProductMaster } from './pages/ProductMaster';
import { Inventory } from './pages/Inventory';
import { Purchasing } from './pages/Purchasing';
import { SalesInvoice } from './pages/SalesInvoice';
import { POS } from './pages/POS';
import { FundRequestPage } from './pages/FundRequest';
import { FundApprovalPage } from './pages/FundApproval';
import { FundRealizationPage } from './pages/FundRealization';
import { RepositoryDokumen } from './pages/RepositoryDokumen';

export interface AddonNavGroup {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isAddon?: boolean; // true = di-gate oleh status add-on (mis. Persediaan & Dagang)
}

export interface AddonNavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<any>; // dirender full-page di area utama saat dipilih dari Sidebar
  group: string;                 // cocok dengan AddonNavGroup.id
}

/** Grup modul add-on — dipakai sebagai judul pemisah section di Sidebar utama.
 * Urutan array = urutan tampil di Sidebar. */
export const ADDON_NAV_GROUPS: AddonNavGroup[] = [
  { id: 'fund',    label: 'Manajemen Dana',      icon: Wallet },
  { id: 'docs',    label: 'Repository Dokumen',  icon: ShieldCheck },
  { id: 'trading', label: 'Persediaan & Dagang', icon: Package, isAddon: true },
];

/** Item navigasi modul add-on. Tampil langsung sebagai item Sidebar utama
 * (dikelompokkan per grup, dipisah garis + label), dan dibuka full-page di
 * area konten utama — bukan nested di dalam Pengaturan. */
export const ADDON_NAV_ITEMS: AddonNavItem[] = [
  // Manajemen Dana
  { id: 'fund-request',     label: 'Pengajuan Dana',   icon: Wallet,         component: FundRequestPage,     group: 'fund' },
  { id: 'fund-realization', label: 'Realisasi Dana',   icon: ClipboardCheck, component: FundRealizationPage, group: 'fund' },
  { id: 'fund-approval',    label: 'Persetujuan Dana', icon: CheckSquare,    component: FundApprovalPage,    group: 'fund' },
  // Repository Dokumen
  { id: 'docs', label: 'Repository Dokumen', icon: ShieldCheck, component: RepositoryDokumen, group: 'docs' },
  // Persediaan & Dagang
  { id: 'products',   label: 'Persediaan & Dagang',     icon: Package,       component: ProductMaster, group: 'trading' },
  { id: 'inventory',  label: 'Kartu Stok & Opname',     icon: ClipboardList, component: Inventory,     group: 'trading' },
  { id: 'purchasing', label: 'Pembelian',               icon: Truck,         component: Purchasing,    group: 'trading' },
  { id: 'sales',      label: 'Faktur Penjualan',        icon: Receipt,       component: SalesInvoice,  group: 'trading' },
  { id: 'pos',        label: 'Point of Sales (Kasir)',  icon: ShoppingCart,  component: POS,           group: 'trading' },
];
