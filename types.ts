
// Define User Roles
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER',
  KARYAWAN = 'KARYAWAN',
}

// Account Types (Categories)
export enum AccountType {
  ASSET = 'ASSET',         // Harta
  LIABILITY = 'LIABILITY', // Kewajiban
  EQUITY = 'EQUITY',       // Modal
  REVENUE = 'REVENUE',     // Pendapatan
  EXPENSE = 'EXPENSE',     // Beban
}

// Cash Flow Categories
export enum CashFlowCategory {
  OPERATING = 'OPERATING',   // Aktivitas Operasional
  INVESTING = 'INVESTING',   // Aktivitas Investasi
  FINANCING = 'FINANCING'    // Aktivitas Pendanaan
}

// Chart of Accounts (COA) Structure
export interface HierarchicalAccount {
  id: string;
  code: string;            // e.g., "1000", "1100"
  name: string;            // e.g., "Kas Besar"
  type: AccountType;
  level: number;           // Hierarchy depth
  parentId?: string | null;
  children?: HierarchicalAccount[];
  balance: number;         // Current balance
  isHeader: boolean;       // If true, cannot record transactions against it directly
  cashFlowCategory?: CashFlowCategory; // New field for Cash Flow Mapping
}

// Contact Interface (Vendor / Customer)
export interface Contact {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string; // NPWP
  notes?: string;
}

// Budget Interface
export interface AccountBudget {
  accountId: string;
  annualAmount: number;
}

// Journal Entry Line Item
export interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;     // Denormalized for display ease
  debit: number;
  credit: number;
  contactId?: string;      // Link to Contact (Optional, for AP/AR)
  contactName?: string;    // Denormalized for display
  description?: string;    // Line-level description (Opsi A)
}

// General Journal Entry
export interface JournalEntry {
  id: string;
  transactionDate: string; // ISO Date
  referenceNumber: string; // e.g., "JV-2023-001"
  description: string;
  attachment?: string | null;     // base64 encoded file
  attachmentName?: string | null; // original filename
  lines: JournalLine[];
  totalAmount: number;     // Validation check (Total Debit == Total Credit)
  createdAt: string;
  createdBy: string;       // User ID
  status: 'DRAFT' | 'POSTED' | 'VOID';
}

// Company Profile Settings
export interface CompanyProfile {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
  taxId?: string; // NPWP
  logoUrl?: string; // Base64 or URL
  signerName?: string;  // Nama penandatangan laporan
  signerTitle?: string; // Jabatan penandatangan laporan
}

// App Configuration
export interface AppConfig {
  lockDate: string; // Tanggal Tutup Buku (No edits allowed before this date)
  fiscalYearStartMonth: number; // 1 = January
  onboardingCompleted: boolean; // false = tampilkan wizard setup pertama kali
}

// Role Permissions Structure
export interface RolePermissions {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageCOA: boolean; // Add/Edit/Delete Accounts
  canEntryJournal: boolean;
  canApproveJournal: boolean; // e.g. Change Draft to Posted
  canDeleteJournal: boolean;
  canViewReports: boolean;
  // Modul Persediaan & Dagang
  canManageInventory: boolean;
  canManagePurchasing: boolean;
  canManageSales: boolean;
  canOperatePOS: boolean;
  canVoidPOSTransaction: boolean;
}

// ─── Modul Persediaan & Dagang ──────────────────────────────────────────────────
export interface ProductCategory {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  name: string;
  abbreviation: string;
}

export interface Warehouse {
  id: number;
  name: string;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  categoryId?: number | null;
  categoryName?: string | null;
  unitId?: number | null;
  unitAbbreviation?: string | null;
  purchasePrice: number;
  sellPrice: number;
  minStock: number;
  currentStock: number;
  avgCost: number;
  isActive: boolean;
}

export interface InventorySettings {
  id: number;
  inventoryAccountId?: string | null;
  stockAdjustmentAccountId?: string | null;
  payableAccountId?: string | null;
  receivableAccountId?: string | null;
  salesRevenueAccountId?: string | null;
  cogsAccountId?: string | null;
  salesTaxAccountId?: string | null;
  posCashAccountId?: string | null;
  posTransferAccountId?: string | null;
  posQrisAccountId?: string | null;
  posCardAccountId?: string | null;
}

export type StockRefType = 'OPENING' | 'ADJUSTMENT' | 'PURCHASE' | 'SALE' | 'POS' | 'TRANSFER';

export interface StockLedgerEntry {
  id: string;
  productId: string;
  warehouseId?: number | null;
  date: string;
  refType: StockRefType;
  refId?: string | null;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  balanceQty: number;
  balanceValue: number;
  description?: string | null;
  createdAt: string;
}

export interface StockAdjustmentLine {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  unitCost: number;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  date: string;
  reason?: string | null;
  status: 'DRAFT' | 'POSTED';
  journalEntryId?: string | null;
  createdAt: string;
  lines?: StockAdjustmentLine[];
}

// ─── Modul Pembelian (Purchase Order & Penerimaan Barang) ───────────────────────
export type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDate?: string | null;
  status: POStatus;
  notes?: string | null;
  createdAt: string;
  lines?: PurchaseOrderLine[];
}

export interface GoodsReceiptLine {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  qty: number;
  unitCost: number;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  poId?: string | null;
  vendorId: string;
  vendorName?: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  receiptDate: string;
  status: 'DRAFT' | 'POSTED';
  totalAmount: number;
  paidAmount: number;
  journalEntryId?: string | null;
  notes?: string | null;
  createdAt: string;
  lines?: GoodsReceiptLine[];
}

export interface PurchasePayment {
  id: string;
  receiptId: string;
  receiptNumber?: string;
  vendorName?: string;
  paymentDate: string;
  amount: number;
  accountId: string;
  accountName?: string;
  notes?: string | null;
  createdAt: string;
}

// ─── Modul Penjualan (Faktur Penjualan B2B) ──────────────────────────────────────
export type SalesInvoiceStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface SalesInvoiceLine {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  status: SalesInvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  journalEntryId?: string | null;
  notes?: string | null;
  createdAt: string;
  lines?: SalesInvoiceLine[];
}

export interface SalesPayment {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  customerName?: string;
  paymentDate: string;
  amount: number;
  accountId: string;
  accountName?: string;
  notes?: string | null;
  createdAt: string;
}

// ─── Modul POS (Point of Sales) ──────────────────────────────────────────────
export type POSPaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'CARD';

export interface POSShift {
  id: string;
  cashierUserId: number;
  cashierName?: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCash?: number | null;
  status: 'OPEN' | 'CLOSED';
  expectedCash?: number;
  difference?: number;
}

export interface POSTransactionLine {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  unitCost: number;
  lineTotal: number;
}

export interface POSTransaction {
  id: string;
  transactionNumber: string;
  shiftId: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  cashierUserId: number;
  cashierName?: string;
  customerId?: string | null;
  customerName?: string;
  transactionDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paymentMethod: POSPaymentMethod;
  paidAmount: number;
  changeAmount: number;
  status: 'COMPLETED' | 'VOID';
  journalEntryId?: string | null;
  createdAt: string;
  lines?: POSTransactionLine[];
}

// Fund Request Interface
export interface FundRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  date: string;
  purpose: string;
  amountRequested: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REALIZED' | 'COMPLETED';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  debitAccountId?: string;
  creditAccountId?: string;
  journalEntryId?: string;
  realization?: FundRealization;
}

// Fund Realization Interface
export interface FundRealization {
  id: string;
  requestId: string;
  date: string;
  actualAmount: number;
  expenseLines: { accountId: string; amount: number }[];
  refundAccountId?: string;
  notes?: string;
  receiptUrls: string[];
  status: 'POSTED';
  journalEntryId: string;
}

// Navigation / Routing Types
export type PageView = 'dashboard' | 'coa' | 'contacts' | 'opening-balance' | 'journal' | 'ledger' | 'reports' | 'settings' | 'ai-assistant' | 'billing' | 'addon';
