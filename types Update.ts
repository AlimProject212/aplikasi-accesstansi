
// Define User Roles
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER',
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
}

// App Configuration
export interface AppConfig {
  lockDate: string; // Tanggal Tutup Buku (No edits allowed before this date)
  fiscalYearStartMonth: number; // 1 = January
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
}

// Fund Request Interface
export interface FundRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  purpose: string;
  amountRequested: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REALIZED' | 'COMPLETED';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  debitAccountId?: string; // Set by accountant
  creditAccountId?: string; // Set by accountant
  realization?: FundRealization;
  journalEntryId?: string; // Link to the first journal entry (Cash Advance)
}

// Fund Realization Interface
export interface ExpenseLine {
  accountId: string;
  amount: number;
}

export interface FundRealization {
  id: string;
  requestId: string;
  date: string;
  actualAmount: number;
  expenseLines: ExpenseLine[];
  refundAccountId?: string;
  notes: string;
  receiptUrls: string[];
  status: 'SUBMITTED' | 'VERIFIED' | 'POSTED';
  verifiedBy?: string;
  verifiedAt?: string;
  journalEntryId?: string; // Link to the second journal entry (Settlement)
}

// Navigation / Routing Types
export type PageView = 'dashboard' | 'coa' | 'contacts' | 'opening-balance' | 'journal' | 'ledger' | 'reports' | 'settings' | 'ai-assistant' | 'fund-request' | 'fund-approval' | 'fund-realization';
