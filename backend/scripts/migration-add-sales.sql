-- Migration: Modul Persediaan & Dagang — Fase 3 (Faktur Penjualan B2B)
-- Jalankan manual di phpMyAdmin SETELAH migration-add-inventory-module.sql (Fase 0),
-- migration-add-stock-engine.sql (Fase 1), dan migration-add-purchasing.sql (Fase 2).
--
-- Catatan: FOREIGN KEY ke tabel lama (accounts, contacts, users) sengaja TIDAK
-- dipasang — lihat catatan di migration-add-stock-engine.sql soal errno 150.

-- ─── Tambah akun Piutang/Pendapatan/HPP/PPN Keluaran ke Pengaturan Persediaan ──
ALTER TABLE inventory_settings ADD COLUMN receivableAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN salesRevenueAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN cogsAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN salesTaxAccountId VARCHAR(36) NULL;

-- ─── Faktur Penjualan ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_invoices (
  id              VARCHAR(36)   PRIMARY KEY,
  companyId       INT           NOT NULL DEFAULT 1,
  invoiceNumber   VARCHAR(255)  NOT NULL,
  customerId      VARCHAR(36)   NOT NULL,
  warehouseId     INT           NULL,
  invoiceDate     DATETIME      NOT NULL,
  dueDate         DATETIME      NULL,
  status          ENUM('DRAFT','POSTED','VOID') NOT NULL DEFAULT 'DRAFT',
  subtotal        DOUBLE        NOT NULL DEFAULT 0,
  discount        DOUBLE        NOT NULL DEFAULT 0,
  tax             DOUBLE        NOT NULL DEFAULT 0,
  totalAmount     DOUBLE        NOT NULL DEFAULT 0,
  paidAmount      DOUBLE        NOT NULL DEFAULT 0,
  journalEntryId  VARCHAR(36)   NULL,
  notes           TEXT          NULL,
  createdById     INT           NOT NULL,
  createdAt       DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_number (companyId, invoiceNumber),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Detail Faktur Penjualan ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id          VARCHAR(36)  PRIMARY KEY,
  invoiceId   VARCHAR(36)  NOT NULL,
  productId   VARCHAR(36)  NOT NULL,
  qty         DOUBLE       NOT NULL,
  unitPrice   DOUBLE       NOT NULL,
  unitCost    DOUBLE       NOT NULL DEFAULT 0,
  lineTotal   DOUBLE       NOT NULL,
  sortOrder   INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Pelunasan Piutang ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_payments (
  id              VARCHAR(36)   PRIMARY KEY,
  companyId       INT           NOT NULL DEFAULT 1,
  invoiceId       VARCHAR(36)   NOT NULL,
  paymentDate     DATETIME      NOT NULL,
  amount          DOUBLE        NOT NULL,
  accountId       VARCHAR(36)   NOT NULL,
  journalEntryId  VARCHAR(36)   NULL,
  notes           TEXT          NULL,
  createdById     INT           NOT NULL,
  createdAt       DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
