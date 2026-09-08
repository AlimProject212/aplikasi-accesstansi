import {
  mysqlTable, varchar, boolean, int, double, text, longtext, datetime,
  mysqlEnum, unique, index,
} from 'drizzle-orm/mysql-core';
import { sql, relations } from 'drizzle-orm';

// ─── COMPANIES ────────────────────────────────────────────────────────────────
export const companies = mysqlTable('companies', {
  id:         int('id').primaryKey().autoincrement(),
  name:       varchar('name', { length: 255 }).notNull(),
  slug:       varchar('slug', { length: 100 }).notNull().unique(),
  code:       varchar('code', { length: 20 }).notNull().unique(),  // Company ID unik, e.g. MAJU-K3P2
  ownerEmail: varchar('ownerEmail', { length: 255 }).notNull(),
  plan:       mysqlEnum('plan', ['FREE', 'PRO', 'ENTERPRISE']).default('FREE').notNull(),
  isActive:   boolean('isActive').default(true).notNull(),
  createdAt:  datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id:                 int('id').primaryKey().autoincrement(),
  companyId:          int('companyId').notNull().default(1),
  name:               varchar('name', { length: 255 }).notNull(),
  email:              varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:       varchar('passwordHash', { length: 255 }).notNull(),
  role:               mysqlEnum('role', ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'ACCOUNTANT', 'VIEWER', 'KARYAWAN']).default('ACCOUNTANT').notNull(),
  linkedAccountId:    varchar('linkedAccountId', { length: 36 }),
  isActive:           boolean('isActive').default(true).notNull(),
  createdAt:          datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:          datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
  canManageUsers:     boolean('canManageUsers').default(false).notNull(),
  canManageSettings:  boolean('canManageSettings').default(false).notNull(),
  canManageCOA:       boolean('canManageCOA').default(false).notNull(),
  canEntryJournal:    boolean('canEntryJournal').default(true).notNull(),
  canApproveJournal:  boolean('canApproveJournal').default(false).notNull(),
  canDeleteJournal:   boolean('canDeleteJournal').default(false).notNull(),
  canViewReports:     boolean('canViewReports').default(true).notNull(),
  // ─── Account lockout ───────────────────────────────────────────────────────
  loginAttempts:      int('loginAttempts').default(0).notNull(),
  lockedUntil:        datetime('lockedUntil', { mode: 'date' }),
  // ─── Modul Persediaan & Dagang ───────────────────────────────────────────────
  canManageInventory:     boolean('canManageInventory').default(false).notNull(),
  canManagePurchasing:    boolean('canManagePurchasing').default(false).notNull(),
  canManageSales:         boolean('canManageSales').default(false).notNull(),
  canOperatePOS:          boolean('canOperatePOS').default(false).notNull(),
  canVoidPOSTransaction:  boolean('canVoidPOSTransaction').default(false).notNull(),
});

// ─── COMPANY PROFILE ──────────────────────────────────────────────────────────
// id = companyId (singleton per company)
export const companyProfile = mysqlTable('company_profile', {
  id:          int('id').primaryKey(),
  name:        varchar('name', { length: 255 }).default('Perusahaan Saya').notNull(),
  address:     text('address').notNull(),
  city:        varchar('city', { length: 255 }).default('').notNull(),
  phone:       varchar('phone', { length: 255 }).default('').notNull(),
  email:       varchar('email', { length: 255 }).default('').notNull(),
  website:     varchar('website', { length: 255 }),
  taxId:       varchar('taxId', { length: 255 }),
  logoUrl:     longtext('logoUrl'),
  signerName:  varchar('signerName', { length: 255 }),
  signerTitle: varchar('signerTitle', { length: 255 }),
  updatedAt:   datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── APP CONFIG ───────────────────────────────────────────────────────────────
// id = companyId (singleton per company)
export const appConfig = mysqlTable('app_config', {
  id:                    int('id').primaryKey(),
  lockDate:              varchar('lockDate', { length: 255 }).default('').notNull(),
  fiscalYearStartMonth:  int('fiscalYearStartMonth').default(1).notNull(),
  activePeriod:          varchar('activePeriod', { length: 255 }).default('').notNull(),
  onboardingCompleted:   boolean('onboardingCompleted').default(true).notNull(),
  updatedAt:             datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── FISCAL YEARS ─────────────────────────────────────────────────────────────
export const fiscalYears = mysqlTable('fiscal_years', {
  id:        int('id').primaryKey().autoincrement(),
  companyId: int('companyId').notNull().default(1),
  year:      varchar('year', { length: 10 }).notNull(),
  isActive:  boolean('isActive').default(false).notNull(),
}, (t) => ({ uniqYearCompany: unique().on(t.year, t.companyId) }));

// ─── LOCKED MONTHS ────────────────────────────────────────────────────────────
export const lockedMonths = mysqlTable('locked_months', {
  id:           int('id').primaryKey().autoincrement(),
  yearMonth:    varchar('yearMonth', { length: 10 }).notNull(),
  fiscalYearId: int('fiscalYearId').notNull().references(() => fiscalYears.id, { onDelete: 'cascade' }),
}, (t) => ({ uniqMonthFY: unique().on(t.yearMonth, t.fiscalYearId) }));

// ─── ACCOUNTS (COA) ───────────────────────────────────────────────────────────
export const accounts = mysqlTable('accounts', {
  id:               varchar('id', { length: 36 }).primaryKey(),
  companyId:        int('companyId').notNull().default(1),
  code:             varchar('code', { length: 255 }).notNull(),
  name:             varchar('name', { length: 255 }).notNull(),
  type:             mysqlEnum('type', ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).notNull(),
  level:            int('level').notNull(),
  parentId:         varchar('parentId', { length: 36 }),
  balance:          double('balance').default(0).notNull(),
  isHeader:         boolean('isHeader').default(false).notNull(),
  cashFlowCategory: mysqlEnum('cashFlowCategory', ['OPERATING', 'INVESTING', 'FINANCING']),
  createdAt:        datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:        datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCodeCompany: unique().on(t.code, t.companyId) }));

// ─── CONTACTS ─────────────────────────────────────────────────────────────────
export const contacts = mysqlTable('contacts', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  companyId: int('companyId').notNull().default(1),
  name:      varchar('name', { length: 255 }).notNull(),
  type:      mysqlEnum('type', ['CUSTOMER', 'VENDOR', 'BOTH']).notNull(),
  email:     varchar('email', { length: 255 }),
  phone:     varchar('phone', { length: 255 }),
  address:   text('address'),
  taxId:     varchar('taxId', { length: 255 }),
  notes:     text('notes'),
  createdAt: datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt: datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── ACCOUNT BUDGETS ──────────────────────────────────────────────────────────
export const accountBudgets = mysqlTable('account_budgets', {
  id:           int('id').primaryKey().autoincrement(),
  companyId:    int('companyId').notNull().default(1),
  accountId:    varchar('accountId', { length: 36 }).notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  fiscalYear:   varchar('fiscalYear', { length: 10 }).notNull(),
  annualAmount: double('annualAmount').default(0).notNull(),
}, (t) => ({ uniq: unique().on(t.accountId, t.fiscalYear) }));

// ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────
export const journalEntries = mysqlTable('journal_entries', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  companyId:       int('companyId').notNull().default(1),
  transactionDate: datetime('transactionDate', { mode: 'date' }).notNull(),
  referenceNumber: varchar('referenceNumber', { length: 255 }).notNull(),
  description:     text('description').notNull(),
  attachment:      longtext('attachment'),
  attachmentName:  varchar('attachmentName', { length: 255 }),
  totalAmount:     double('totalAmount').notNull(),
  status:          mysqlEnum('status', ['DRAFT', 'POSTED', 'VOID']).default('DRAFT').notNull(),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:       datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
  createdById:     int('createdById').notNull().references(() => users.id),
}, (t) => ({
  idxDate:        index('idx_date').on(t.transactionDate),
  idxStatus:      index('idx_status').on(t.status),
  uniqRefCompany: unique().on(t.referenceNumber, t.companyId),
}));

// ─── JOURNAL LINES ────────────────────────────────────────────────────────────
export const journalLines = mysqlTable('journal_lines', {
  id:          varchar('id', { length: 36 }).primaryKey(),
  journalId:   varchar('journalId', { length: 36 }).notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId:   varchar('accountId', { length: 36 }).notNull().references(() => accounts.id),
  accountName: varchar('accountName', { length: 255 }).notNull(),
  debit:       double('debit').default(0).notNull(),
  credit:      double('credit').default(0).notNull(),
  contactId:   varchar('contactId', { length: 36 }),
  contactName: varchar('contactName', { length: 255 }),
  description: text('description'),
  sortOrder:   int('sortOrder').default(0).notNull(),
}, (t) => ({
  idxJournal: index('idx_journal').on(t.journalId),
  idxAccount: index('idx_account').on(t.accountId),
}));

// ─── BANK STATEMENT KEYWORDS (kamus belajar kategori COA utk import rekening koran) ─
export const bankStatementKeywords = mysqlTable('bank_statement_keywords', {
  id:         int('id').primaryKey().autoincrement(),
  companyId:  int('companyId').notNull().default(1),
  accountId:  varchar('accountId', { length: 191 }).notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  keyword:    varchar('keyword', { length: 255 }).notNull(),
  matchCount: int('matchCount').default(1).notNull(),
  updatedAt:  datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyKeyword: unique().on(t.companyId, t.keyword) }));

// ─── API CONFIGS ──────────────────────────────────────────────────────────────
export const apiConfigs = mysqlTable('api_configs', {
  id:          int('id').primaryKey().autoincrement(),
  companyId:   int('companyId').notNull().default(1),
  serviceName: varchar('serviceName', { length: 100 }).notNull(),
  keyName:     varchar('keyName', { length: 100 }).notNull(),
  keyValue:    text('keyValue').notNull(),
  description: varchar('description', { length: 255 }),
  isActive:    boolean('isActive').default(true).notNull(),
  createdAt:   datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:   datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── AUDIT DOCUMENTS ──────────────────────────────────────────────────────────
export const auditDocuments = mysqlTable('audit_documents', {
  id:          int('id').primaryKey().autoincrement(),
  companyId:   int('companyId').notNull().default(1),
  name:        varchar('name', { length: 255 }).notNull(),
  category:    varchar('category', { length: 100 }).notNull(),
  year:        varchar('year', { length: 10 }).notNull(),
  status:      mysqlEnum('status', ['RED', 'YELLOW', 'GREEN']).default('YELLOW').notNull(),
  uploadedBy:  varchar('uploadedBy', { length: 255 }),
  fileSize:    varchar('fileSize', { length: 50 }),
  filePath:    varchar('filePath', { length: 500 }).notNull(),
  mimeType:    varchar('mimeType', { length: 100 }),
  journalRef:  varchar('journalRef', { length: 100 }),
  createdAt:   datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:   datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── FUND REQUESTS ────────────────────────────────────────────────────────────
export const fundRequests = mysqlTable('fund_requests', {
  id:                         varchar('id', { length: 36 }).primaryKey(),
  companyId:                  int('companyId').notNull().default(1),
  employeeId:                 varchar('employeeId', { length: 255 }).notNull(),
  employeeName:               varchar('employeeName', { length: 255 }).notNull(),
  employeeRole:               varchar('employeeRole', { length: 100 }),
  date:                       varchar('date', { length: 20 }).notNull(),
  purpose:                    text('purpose').notNull(),
  amountRequested:            double('amountRequested').notNull(),
  status:                     mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED', 'REALIZED', 'COMPLETED']).default('PENDING').notNull(),
  approvedBy:                 varchar('approvedBy', { length: 255 }),
  approvedAt:                 varchar('approvedAt', { length: 30 }),
  rejectionReason:            text('rejectionReason'),
  debitAccountId:             varchar('debitAccountId', { length: 36 }),
  creditAccountId:            varchar('creditAccountId', { length: 36 }),
  journalEntryId:             varchar('journalEntryId', { length: 36 }),
  realizationId:              varchar('realizationId', { length: 36 }),
  realizationDate:            varchar('realizationDate', { length: 20 }),
  realizationActualAmount:    double('realizationActualAmount'),
  realizationExpenseLines:    text('realizationExpenseLines'),
  realizationRefundAccountId: varchar('realizationRefundAccountId', { length: 36 }),
  realizationNotes:           text('realizationNotes'),
  realizationJournalId:       varchar('realizationJournalId', { length: 36 }),
  createdAt:                  datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:                  datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── ADDON MODULES ────────────────────────────────────────────────────────────
export const addonModules = mysqlTable('addon_modules', {
  id:          int('id').primaryKey().autoincrement(),
  name:        varchar('name', { length: 255 }).notNull(),
  slug:        varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  priceMonthly: int('priceMonthly').notNull().default(0),   // in IDR
  isActive:    boolean('isActive').default(true).notNull(),
});

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
export const subscriptions = mysqlTable('subscriptions', {
  id:              int('id').primaryKey().autoincrement(),
  companyId:       int('companyId').notNull(),
  billingCycle:    mysqlEnum('billingCycle', ['monthly', 'yearly']).notNull(),
  status:          mysqlEnum('status', ['active', 'expired', 'pending']).default('pending').notNull(),
  startDate:       datetime('startDate', { mode: 'date' }),
  endDate:         datetime('endDate', { mode: 'date' }),
  reminderSentAt:  datetime('reminderSentAt', { mode: 'date' }),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:       datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── COMPANY ADDONS ───────────────────────────────────────────────────────────
export const companyAddons = mysqlTable('company_addons', {
  id:        int('id').primaryKey().autoincrement(),
  companyId: int('companyId').notNull(),
  moduleId:  int('moduleId').notNull().references(() => addonModules.id),
  status:    mysqlEnum('status', ['active', 'expired']).default('active').notNull(),
  startDate: datetime('startDate', { mode: 'date' }),
  endDate:   datetime('endDate', { mode: 'date' }),
}, (t) => ({ uniqCompanyModule: unique().on(t.companyId, t.moduleId) }));

// ─── INVOICES ─────────────────────────────────────────────────────────────────
export const invoices = mysqlTable('invoices', {
  id:              varchar('id', { length: 36 }).primaryKey(),  // UUID
  companyId:       int('companyId').notNull(),
  type:            mysqlEnum('type', ['subscription', 'addon']).notNull(),
  description:     varchar('description', { length: 500 }).notNull(),
  amount:          int('amount').notNull(),   // IDR
  status:          mysqlEnum('status', ['pending', 'paid', 'failed', 'expired']).default('pending').notNull(),
  billingCycle:    mysqlEnum('billingCycle', ['monthly', 'yearly']),
  addonModuleId:   int('addonModuleId'),
  gatewayOrderId:  varchar('gatewayOrderId', { length: 100 }),
  snapToken:       text('snapToken'),
  paidAt:          datetime('paidAt', { mode: 'date' }),
  expiredAt:       datetime('expiredAt', { mode: 'date' }),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
});

// ─── DOCUMENT CATEGORIES ──────────────────────────────────────────────────────
export const documentCategories = mysqlTable('document_categories', {
  id:          int('id').primaryKey().autoincrement(),
  companyId:   int('companyId').notNull().default(1),
  label:       varchar('label', { length: 100 }).notNull(),
  categoryKey: varchar('categoryKey', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  isDefault:   boolean('isDefault').default(false).notNull(),
  sortOrder:   int('sortOrder').default(0).notNull(),
  createdAt:   datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:   datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyKey: unique().on(t.companyId, t.categoryKey) }));

// ─── DOCUMENT GROUPS ──────────────────────────────────────────────────────────
export const documentGroups = mysqlTable('document_groups', {
  id:          int('id').primaryKey().autoincrement(),
  companyId:   int('companyId').notNull().default(1),
  name:        varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdBy:   varchar('createdBy', { length: 255 }),
  createdAt:   datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:   datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── DOCUMENT GROUP MEMBERS ────────────────────────────────────────────────────
export const documentGroupMembers = mysqlTable('document_group_members', {
  id:         int('id').primaryKey().autoincrement(),
  groupId:    int('groupId').notNull().references(() => documentGroups.id, { onDelete: 'cascade' }),
  documentId: int('documentId').notNull().references(() => auditDocuments.id, { onDelete: 'cascade' }),
  addedBy:    varchar('addedBy', { length: 255 }),
  addedAt:    datetime('addedAt', { mode: 'date' }).default(sql`now()`).notNull(),
}, (t) => ({ uniqGroupDoc: unique().on(t.groupId, t.documentId) }));

// ─── PRODUCT CATEGORIES (Kategori Barang) ──────────────────────────────────────
export const productCategories = mysqlTable('product_categories', {
  id:        int('id').primaryKey().autoincrement(),
  companyId: int('companyId').notNull().default(1),
  name:      varchar('name', { length: 255 }).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt: datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyName: unique().on(t.companyId, t.name) }));

// ─── UNITS (Satuan Barang) ──────────────────────────────────────────────────────
export const units = mysqlTable('units', {
  id:           int('id').primaryKey().autoincrement(),
  companyId:    int('companyId').notNull().default(1),
  name:         varchar('name', { length: 100 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 20 }).notNull(),
  createdAt:    datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
}, (t) => ({ uniqCompanyName: unique().on(t.companyId, t.name) }));

// ─── WAREHOUSES (Gudang) ─────────────────────────────────────────────────────────
export const warehouses = mysqlTable('warehouses', {
  id:        int('id').primaryKey().autoincrement(),
  companyId: int('companyId').notNull().default(1),
  name:      varchar('name', { length: 255 }).notNull(),
  address:   text('address'),
  isDefault: boolean('isDefault').default(false).notNull(),
  isActive:  boolean('isActive').default(true).notNull(),
  createdAt: datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
}, (t) => ({ uniqCompanyName: unique().on(t.companyId, t.name) }));

// ─── PRODUCTS (Master Barang Dagang) ────────────────────────────────────────────
export const products = mysqlTable('products', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  companyId:     int('companyId').notNull().default(1),
  sku:           varchar('sku', { length: 100 }).notNull(),
  barcode:       varchar('barcode', { length: 100 }),
  name:          varchar('name', { length: 255 }).notNull(),
  categoryId:    int('categoryId').references(() => productCategories.id),
  unitId:        int('unitId').references(() => units.id),
  purchasePrice: double('purchasePrice').default(0).notNull(),
  sellPrice:     double('sellPrice').default(0).notNull(),
  minStock:      double('minStock').default(0).notNull(),
  currentStock:  double('currentStock').default(0).notNull(),
  avgCost:       double('avgCost').default(0).notNull(),
  isActive:      boolean('isActive').default(true).notNull(),
  createdAt:     datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:     datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({
  uniqCompanySku: unique().on(t.companyId, t.sku),
  idxBarcode:     index('idx_product_barcode').on(t.barcode),
  idxName:        index('idx_product_name').on(t.name),
}));

// ─── INVENTORY SETTINGS (Pengaturan Akun Persediaan) ────────────────────────────
// id = companyId (singleton per company)
export const inventorySettings = mysqlTable('inventory_settings', {
  id:                        int('id').primaryKey(),
  inventoryAccountId:        varchar('inventoryAccountId', { length: 36 }).references(() => accounts.id),
  stockAdjustmentAccountId:  varchar('stockAdjustmentAccountId', { length: 36 }).references(() => accounts.id),
  payableAccountId:          varchar('payableAccountId', { length: 36 }).references(() => accounts.id),
  receivableAccountId:       varchar('receivableAccountId', { length: 36 }).references(() => accounts.id),
  salesRevenueAccountId:     varchar('salesRevenueAccountId', { length: 36 }).references(() => accounts.id),
  cogsAccountId:             varchar('cogsAccountId', { length: 36 }).references(() => accounts.id),
  salesTaxAccountId:         varchar('salesTaxAccountId', { length: 36 }).references(() => accounts.id),
  posCashAccountId:          varchar('posCashAccountId', { length: 36 }).references(() => accounts.id),
  posTransferAccountId:      varchar('posTransferAccountId', { length: 36 }).references(() => accounts.id),
  posQrisAccountId:          varchar('posQrisAccountId', { length: 36 }).references(() => accounts.id),
  posCardAccountId:          varchar('posCardAccountId', { length: 36 }).references(() => accounts.id),
  updatedAt:                 datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
});

// ─── STOCK LEDGER (Kartu Stok) ───────────────────────────────────────────────────
// Immutable audit trail — sumber kebenaran untuk saldo & HPP rata-rata bergerak.
export const stockLedger = mysqlTable('stock_ledger', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  companyId:    int('companyId').notNull().default(1),
  productId:    varchar('productId', { length: 36 }).notNull().references(() => products.id),
  warehouseId:  int('warehouseId').references(() => warehouses.id),
  date:         datetime('date', { mode: 'date' }).notNull(),
  refType:      mysqlEnum('refType', ['OPENING', 'ADJUSTMENT', 'PURCHASE', 'SALE', 'POS', 'TRANSFER']).notNull(),
  refId:        varchar('refId', { length: 36 }),
  qtyIn:        double('qtyIn').default(0).notNull(),
  qtyOut:       double('qtyOut').default(0).notNull(),
  unitCost:     double('unitCost').default(0).notNull(),
  balanceQty:   double('balanceQty').notNull(),
  balanceValue: double('balanceValue').notNull(),
  description:  varchar('description', { length: 255 }),
  createdById:  int('createdById').notNull().references(() => users.id),
  createdAt:    datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
}, (t) => ({
  idxProduct:       index('idx_stockledger_product').on(t.productId),
  idxCompanyDate:   index('idx_stockledger_company_date').on(t.companyId, t.date),
}));

// ─── STOCK ADJUSTMENTS (Penyesuaian Stok / Opname) ──────────────────────────────
export const stockAdjustments = mysqlTable('stock_adjustments', {
  id:                varchar('id', { length: 36 }).primaryKey(),
  companyId:         int('companyId').notNull().default(1),
  adjustmentNumber:  varchar('adjustmentNumber', { length: 255 }).notNull(),
  warehouseId:       int('warehouseId').references(() => warehouses.id),
  date:              datetime('date', { mode: 'date' }).notNull(),
  reason:            text('reason'),
  status:            mysqlEnum('status', ['DRAFT', 'POSTED']).default('DRAFT').notNull(),
  journalEntryId:    varchar('journalEntryId', { length: 36 }),
  createdById:       int('createdById').notNull().references(() => users.id),
  createdAt:         datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:         datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyNumber: unique().on(t.companyId, t.adjustmentNumber) }));

// ─── STOCK ADJUSTMENT LINES ──────────────────────────────────────────────────────
export const stockAdjustmentLines = mysqlTable('stock_adjustment_lines', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  adjustmentId:  varchar('adjustmentId', { length: 36 }).notNull().references(() => stockAdjustments.id, { onDelete: 'cascade' }),
  productId:     varchar('productId', { length: 36 }).notNull().references(() => products.id),
  systemQty:     double('systemQty').notNull(),
  actualQty:     double('actualQty').notNull(),
  difference:    double('difference').notNull(),
  unitCost:      double('unitCost').default(0).notNull(),
  sortOrder:     int('sortOrder').default(0).notNull(),
});

// ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────
export const purchaseOrders = mysqlTable('purchase_orders', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  companyId:     int('companyId').notNull().default(1),
  poNumber:      varchar('poNumber', { length: 255 }).notNull(),
  vendorId:      varchar('vendorId', { length: 36 }).notNull().references(() => contacts.id),
  orderDate:     datetime('orderDate', { mode: 'date' }).notNull(),
  expectedDate:  datetime('expectedDate', { mode: 'date' }),
  status:        mysqlEnum('status', ['DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED']).default('DRAFT').notNull(),
  notes:         text('notes'),
  createdById:   int('createdById').notNull().references(() => users.id),
  createdAt:     datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:     datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyNumber: unique().on(t.companyId, t.poNumber) }));

// ─── PURCHASE ORDER LINES ─────────────────────────────────────────────────────
export const purchaseOrderLines = mysqlTable('purchase_order_lines', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  poId:         varchar('poId', { length: 36 }).notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId:    varchar('productId', { length: 36 }).notNull().references(() => products.id),
  qtyOrdered:   double('qtyOrdered').notNull(),
  qtyReceived:  double('qtyReceived').default(0).notNull(),
  unitPrice:    double('unitPrice').default(0).notNull(),
  sortOrder:    int('sortOrder').default(0).notNull(),
});

// ─── GOODS RECEIPTS (Penerimaan Barang) ──────────────────────────────────────────
export const goodsReceipts = mysqlTable('goods_receipts', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  companyId:       int('companyId').notNull().default(1),
  receiptNumber:   varchar('receiptNumber', { length: 255 }).notNull(),
  poId:            varchar('poId', { length: 36 }),
  vendorId:        varchar('vendorId', { length: 36 }).notNull().references(() => contacts.id),
  warehouseId:     int('warehouseId').references(() => warehouses.id),
  receiptDate:     datetime('receiptDate', { mode: 'date' }).notNull(),
  status:          mysqlEnum('status', ['DRAFT', 'POSTED']).default('DRAFT').notNull(),
  totalAmount:     double('totalAmount').default(0).notNull(),
  paidAmount:      double('paidAmount').default(0).notNull(),
  journalEntryId:  varchar('journalEntryId', { length: 36 }),
  notes:           text('notes'),
  createdById:     int('createdById').notNull().references(() => users.id),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:       datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyNumber: unique().on(t.companyId, t.receiptNumber) }));

// ─── GOODS RECEIPT LINES ──────────────────────────────────────────────────────
export const goodsReceiptLines = mysqlTable('goods_receipt_lines', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  receiptId:  varchar('receiptId', { length: 36 }).notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  productId:  varchar('productId', { length: 36 }).notNull().references(() => products.id),
  qty:        double('qty').notNull(),
  unitCost:   double('unitCost').notNull(),
  sortOrder:  int('sortOrder').default(0).notNull(),
});

// ─── PURCHASE PAYMENTS (Pelunasan Hutang) ────────────────────────────────────────
export const purchasePayments = mysqlTable('purchase_payments', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  companyId:       int('companyId').notNull().default(1),
  receiptId:       varchar('receiptId', { length: 36 }).notNull().references(() => goodsReceipts.id),
  paymentDate:     datetime('paymentDate', { mode: 'date' }).notNull(),
  amount:          double('amount').notNull(),
  accountId:       varchar('accountId', { length: 36 }).notNull().references(() => accounts.id),
  journalEntryId:  varchar('journalEntryId', { length: 36 }),
  notes:           text('notes'),
  createdById:     int('createdById').notNull().references(() => users.id),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
});

// ─── SALES INVOICES (Faktur Penjualan B2B) ───────────────────────────────────────
export const salesInvoices = mysqlTable('sales_invoices', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  companyId:       int('companyId').notNull().default(1),
  invoiceNumber:   varchar('invoiceNumber', { length: 255 }).notNull(),
  customerId:      varchar('customerId', { length: 36 }).notNull().references(() => contacts.id),
  warehouseId:     int('warehouseId').references(() => warehouses.id),
  invoiceDate:     datetime('invoiceDate', { mode: 'date' }).notNull(),
  dueDate:         datetime('dueDate', { mode: 'date' }),
  status:          mysqlEnum('status', ['DRAFT', 'POSTED', 'VOID']).default('DRAFT').notNull(),
  subtotal:        double('subtotal').default(0).notNull(),
  discount:        double('discount').default(0).notNull(),
  tax:             double('tax').default(0).notNull(),
  totalAmount:     double('totalAmount').default(0).notNull(),
  paidAmount:      double('paidAmount').default(0).notNull(),
  journalEntryId:  varchar('journalEntryId', { length: 36 }),
  notes:           text('notes'),
  createdById:     int('createdById').notNull().references(() => users.id),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
  updatedAt:       datetime('updatedAt', { mode: 'date' }).default(sql`now()`).notNull().$onUpdate(() => new Date()),
}, (t) => ({ uniqCompanyNumber: unique().on(t.companyId, t.invoiceNumber) }));

// ─── SALES INVOICE LINES ──────────────────────────────────────────────────────
export const salesInvoiceLines = mysqlTable('sales_invoice_lines', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  invoiceId:  varchar('invoiceId', { length: 36 }).notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  productId:  varchar('productId', { length: 36 }).notNull().references(() => products.id),
  qty:        double('qty').notNull(),
  unitPrice:  double('unitPrice').notNull(),
  unitCost:   double('unitCost').default(0).notNull(),
  lineTotal:  double('lineTotal').notNull(),
  sortOrder:  int('sortOrder').default(0).notNull(),
});

// ─── SALES PAYMENTS (Pelunasan Piutang) ──────────────────────────────────────────
export const salesPayments = mysqlTable('sales_payments', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  companyId:       int('companyId').notNull().default(1),
  invoiceId:       varchar('invoiceId', { length: 36 }).notNull().references(() => salesInvoices.id),
  paymentDate:     datetime('paymentDate', { mode: 'date' }).notNull(),
  amount:          double('amount').notNull(),
  accountId:       varchar('accountId', { length: 36 }).notNull().references(() => accounts.id),
  journalEntryId:  varchar('journalEntryId', { length: 36 }),
  notes:           text('notes'),
  createdById:     int('createdById').notNull().references(() => users.id),
  createdAt:       datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
});

// ─── POS SHIFTS (Sesi Kasir) ──────────────────────────────────────────────────
export const posShifts = mysqlTable('pos_shifts', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  companyId:     int('companyId').notNull().default(1),
  cashierUserId: int('cashierUserId').notNull().references(() => users.id),
  warehouseId:   int('warehouseId').references(() => warehouses.id),
  openedAt:      datetime('openedAt', { mode: 'date' }).notNull(),
  closedAt:      datetime('closedAt', { mode: 'date' }),
  openingCash:   double('openingCash').default(0).notNull(),
  closingCash:   double('closingCash'),
  status:        mysqlEnum('status', ['OPEN', 'CLOSED']).default('OPEN').notNull(),
  createdAt:     datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
});

// ─── POS TRANSACTIONS (Transaksi Kasir) ──────────────────────────────────────────
export const posTransactions = mysqlTable('pos_transactions', {
  id:                  varchar('id', { length: 36 }).primaryKey(),
  companyId:           int('companyId').notNull().default(1),
  shiftId:             varchar('shiftId', { length: 36 }).notNull(),
  transactionNumber:   varchar('transactionNumber', { length: 255 }).notNull(),
  warehouseId:         int('warehouseId').references(() => warehouses.id),
  cashierUserId:       int('cashierUserId').notNull().references(() => users.id),
  customerId:          varchar('customerId', { length: 36 }),
  transactionDate:     datetime('transactionDate', { mode: 'date' }).notNull(),
  subtotal:            double('subtotal').default(0).notNull(),
  discount:            double('discount').default(0).notNull(),
  tax:                 double('tax').default(0).notNull(),
  totalAmount:         double('totalAmount').default(0).notNull(),
  paymentMethod:       mysqlEnum('paymentMethod', ['CASH', 'TRANSFER', 'QRIS', 'CARD']).notNull(),
  paidAmount:          double('paidAmount').default(0).notNull(),
  changeAmount:        double('changeAmount').default(0).notNull(),
  status:              mysqlEnum('status', ['COMPLETED', 'VOID']).default('COMPLETED').notNull(),
  journalEntryId:      varchar('journalEntryId', { length: 36 }),
  voidJournalEntryId:  varchar('voidJournalEntryId', { length: 36 }),
  notes:               text('notes'),
  createdAt:           datetime('createdAt', { mode: 'date' }).default(sql`now()`).notNull(),
}, (t) => ({
  uniqCompanyNumber: unique().on(t.companyId, t.transactionNumber),
  idxShift:          index('idx_postx_shift').on(t.shiftId),
}));

// ─── POS TRANSACTION LINES ────────────────────────────────────────────────────
export const posTransactionLines = mysqlTable('pos_transaction_lines', {
  id:            varchar('id', { length: 36 }).primaryKey(),
  transactionId: varchar('transactionId', { length: 36 }).notNull().references(() => posTransactions.id, { onDelete: 'cascade' }),
  productId:     varchar('productId', { length: 36 }).notNull().references(() => products.id),
  qty:           double('qty').notNull(),
  unitPrice:     double('unitPrice').notNull(),
  discount:      double('discount').default(0).notNull(),
  unitCost:      double('unitCost').default(0).notNull(),
  lineTotal:     double('lineTotal').notNull(),
  sortOrder:     int('sortOrder').default(0).notNull(),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  journals: many(journalEntries),
}));

export const fiscalYearsRelations = relations(fiscalYears, ({ many }) => ({
  lockedMonths: many(lockedMonths),
}));

export const lockedMonthsRelations = relations(lockedMonths, ({ one }) => ({
  fiscalYear: one(fiscalYears, { fields: [lockedMonths.fiscalYearId], references: [fiscalYears.id] }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  journalLines: many(journalLines),
  budgets:      many(accountBudgets),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  journalLines: many(journalLines),
}));

export const accountBudgetsRelations = relations(accountBudgets, ({ one }) => ({
  account: one(accounts, { fields: [accountBudgets.accountId], references: [accounts.id] }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  lines:     many(journalLines),
  createdBy: one(users, { fields: [journalEntries.createdById], references: [users.id] }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journal: one(journalEntries, { fields: [journalLines.journalId], references: [journalEntries.id] }),
  account: one(accounts,      { fields: [journalLines.accountId], references: [accounts.id] }),
  contact: one(contacts,      { fields: [journalLines.contactId], references: [contacts.id] }),
}));

export const documentGroupsRelations = relations(documentGroups, ({ many }) => ({
  members: many(documentGroupMembers),
}));

export const documentGroupMembersRelations = relations(documentGroupMembers, ({ one }) => ({
  group:    one(documentGroups,  { fields: [documentGroupMembers.groupId],    references: [documentGroups.id] }),
  document: one(auditDocuments, { fields: [documentGroupMembers.documentId], references: [auditDocuments.id] }),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const unitsRelations = relations(units, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category:      one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  unit:          one(units,             { fields: [products.unitId],     references: [units.id] }),
  stockLedger:   many(stockLedger),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  product:   one(products,   { fields: [stockLedger.productId],   references: [products.id] }),
  warehouse: one(warehouses, { fields: [stockLedger.warehouseId], references: [warehouses.id] }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ many }) => ({
  lines: many(stockAdjustmentLines),
}));

export const stockAdjustmentLinesRelations = relations(stockAdjustmentLines, ({ one }) => ({
  adjustment: one(stockAdjustments, { fields: [stockAdjustmentLines.adjustmentId], references: [stockAdjustments.id] }),
  product:    one(products,         { fields: [stockAdjustmentLines.productId],   references: [products.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ many, one }) => ({
  lines:  many(purchaseOrderLines),
  vendor: one(contacts, { fields: [purchaseOrders.vendorId], references: [contacts.id] }),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  po:      one(purchaseOrders, { fields: [purchaseOrderLines.poId],      references: [purchaseOrders.id] }),
  product: one(products,       { fields: [purchaseOrderLines.productId], references: [products.id] }),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ many, one }) => ({
  lines:  many(goodsReceiptLines),
  vendor: one(contacts, { fields: [goodsReceipts.vendorId], references: [contacts.id] }),
  po:     one(purchaseOrders, { fields: [goodsReceipts.poId], references: [purchaseOrders.id] }),
}));

export const goodsReceiptLinesRelations = relations(goodsReceiptLines, ({ one }) => ({
  receipt: one(goodsReceipts, { fields: [goodsReceiptLines.receiptId], references: [goodsReceipts.id] }),
  product: one(products,      { fields: [goodsReceiptLines.productId], references: [products.id] }),
}));

export const purchasePaymentsRelations = relations(purchasePayments, ({ one }) => ({
  receipt: one(goodsReceipts, { fields: [purchasePayments.receiptId], references: [goodsReceipts.id] }),
  account: one(accounts,      { fields: [purchasePayments.accountId], references: [accounts.id] }),
}));

export const salesInvoicesRelations = relations(salesInvoices, ({ many, one }) => ({
  lines:    many(salesInvoiceLines),
  customer: one(contacts, { fields: [salesInvoices.customerId], references: [contacts.id] }),
}));

export const salesInvoiceLinesRelations = relations(salesInvoiceLines, ({ one }) => ({
  invoice: one(salesInvoices, { fields: [salesInvoiceLines.invoiceId], references: [salesInvoices.id] }),
  product: one(products,      { fields: [salesInvoiceLines.productId], references: [products.id] }),
}));

export const salesPaymentsRelations = relations(salesPayments, ({ one }) => ({
  invoice: one(salesInvoices, { fields: [salesPayments.invoiceId], references: [salesInvoices.id] }),
  account: one(accounts,      { fields: [salesPayments.accountId], references: [accounts.id] }),
}));

export const posShiftsRelations = relations(posShifts, ({ many }) => ({
  transactions: many(posTransactions),
}));

export const posTransactionsRelations = relations(posTransactions, ({ one, many }) => ({
  shift:    one(posShifts, { fields: [posTransactions.shiftId], references: [posShifts.id] }),
  customer: one(contacts,  { fields: [posTransactions.customerId], references: [contacts.id] }),
  lines:    many(posTransactionLines),
}));

export const posTransactionLinesRelations = relations(posTransactionLines, ({ one }) => ({
  transaction: one(posTransactions, { fields: [posTransactionLines.transactionId], references: [posTransactions.id] }),
  product:     one(products,        { fields: [posTransactionLines.productId],     references: [products.id] }),
}));
