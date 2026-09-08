-- Migration: Modul Persediaan & Dagang — Fase 4 (Point of Sales)
-- Jalankan manual di phpMyAdmin SETELAH migration-add-inventory-module.sql (Fase 0),
-- migration-add-stock-engine.sql (Fase 1), migration-add-purchasing.sql (Fase 2),
-- dan migration-add-sales.sql (Fase 3).
--
-- Catatan: FOREIGN KEY ke tabel lama (accounts, contacts, users) sengaja TIDAK
-- dipasang (lihat catatan di migration-add-stock-engine.sql). Semua tabel baru
-- eksplisit COLLATE=utf8mb4_unicode_ci dari awal biar konsisten sama tabel lama.

-- ─── Tambah akun pembayaran POS ke Pengaturan Persediaan ─────────────────────
ALTER TABLE inventory_settings ADD COLUMN posCashAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN posTransferAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN posQrisAccountId VARCHAR(36) NULL;
ALTER TABLE inventory_settings ADD COLUMN posCardAccountId VARCHAR(36) NULL;

-- ─── Sesi Kasir (Shift) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_shifts (
  id             VARCHAR(36)   PRIMARY KEY,
  companyId      INT           NOT NULL DEFAULT 1,
  cashierUserId  INT           NOT NULL,
  warehouseId    INT           NULL,
  openedAt       DATETIME      NOT NULL,
  closedAt       DATETIME      NULL,
  openingCash    DOUBLE        NOT NULL DEFAULT 0,
  closingCash    DOUBLE        NULL,
  status         ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  createdAt      DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Transaksi Kasir ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_transactions (
  id                  VARCHAR(36)   PRIMARY KEY,
  companyId           INT           NOT NULL DEFAULT 1,
  shiftId             VARCHAR(36)   NOT NULL,
  transactionNumber   VARCHAR(255)  NOT NULL,
  warehouseId         INT           NULL,
  cashierUserId       INT           NOT NULL,
  customerId          VARCHAR(36)   NULL,
  transactionDate     DATETIME      NOT NULL,
  subtotal            DOUBLE        NOT NULL DEFAULT 0,
  discount            DOUBLE        NOT NULL DEFAULT 0,
  tax                 DOUBLE        NOT NULL DEFAULT 0,
  totalAmount         DOUBLE        NOT NULL DEFAULT 0,
  paymentMethod       ENUM('CASH','TRANSFER','QRIS','CARD') NOT NULL,
  paidAmount          DOUBLE        NOT NULL DEFAULT 0,
  changeAmount        DOUBLE        NOT NULL DEFAULT 0,
  status              ENUM('COMPLETED','VOID') NOT NULL DEFAULT 'COMPLETED',
  journalEntryId      VARCHAR(36)   NULL,
  voidJournalEntryId  VARCHAR(36)   NULL,
  notes               TEXT          NULL,
  createdAt           DATETIME      NOT NULL DEFAULT NOW(),
  UNIQUE KEY uniq_company_number (companyId, transactionNumber),
  KEY idx_postx_shift (shiftId),
  FOREIGN KEY (shiftId) REFERENCES pos_shifts(id),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Detail Transaksi Kasir ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_transaction_lines (
  id             VARCHAR(36)  PRIMARY KEY,
  transactionId  VARCHAR(36)  NOT NULL,
  productId      VARCHAR(36)  NOT NULL,
  qty            DOUBLE       NOT NULL,
  unitPrice      DOUBLE       NOT NULL,
  discount       DOUBLE       NOT NULL DEFAULT 0,
  unitCost       DOUBLE       NOT NULL DEFAULT 0,
  lineTotal      DOUBLE       NOT NULL,
  sortOrder      INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (transactionId) REFERENCES pos_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
