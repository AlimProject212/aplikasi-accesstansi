-- Migration: Modul Persediaan & Dagang — Fase 1 (Engine Kartu Stok)
-- Jalankan manual di phpMyAdmin SETELAH migration-add-inventory-module.sql (Fase 0).
--
-- Catatan: FOREIGN KEY ke tabel lama (accounts, users) sengaja TIDAK dipasang —
-- tabel-tabel itu dibuat di luar migration ini (kemungkinan collation/charset beda),
-- yang bikin "errno 150" saat CREATE TABLE. Validasi keberadaan data tetap dijaga
-- di level aplikasi (controller), bukan di level DB, untuk kolom-kolom ini.

-- ─── Pengaturan Akun Persediaan (singleton per company) ─────────────────────────
CREATE TABLE IF NOT EXISTS inventory_settings (
  id                        INT           PRIMARY KEY,
  inventoryAccountId        VARCHAR(36)   NULL,
  stockAdjustmentAccountId  VARCHAR(36)   NULL,
  updatedAt                 DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Kartu Stok (immutable ledger) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
  id            VARCHAR(36)   PRIMARY KEY,
  companyId     INT           NOT NULL DEFAULT 1,
  productId     VARCHAR(36)   NOT NULL,
  warehouseId   INT           NULL,
  date          DATETIME      NOT NULL,
  refType       ENUM('OPENING','ADJUSTMENT','PURCHASE','SALE','POS','TRANSFER') NOT NULL,
  refId         VARCHAR(36)   NULL,
  qtyIn         DOUBLE        NOT NULL DEFAULT 0,
  qtyOut        DOUBLE        NOT NULL DEFAULT 0,
  unitCost      DOUBLE        NOT NULL DEFAULT 0,
  balanceQty    DOUBLE        NOT NULL,
  balanceValue  DOUBLE        NOT NULL,
  description   VARCHAR(255)  NULL,
  createdById   INT           NOT NULL,
  createdAt     DATETIME      NOT NULL DEFAULT NOW(),
  KEY idx_stockledger_product (productId),
  KEY idx_stockledger_company_date (companyId, date),
  FOREIGN KEY (productId) REFERENCES products(id),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Penyesuaian Stok (Opname) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id                VARCHAR(36)   PRIMARY KEY,
  companyId         INT           NOT NULL DEFAULT 1,
  adjustmentNumber  VARCHAR(255)  NOT NULL,
  warehouseId       INT           NULL,
  date              DATETIME      NOT NULL,
  reason            TEXT          NULL,
  status            ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
  journalEntryId    VARCHAR(36)   NULL,
  createdById       INT           NOT NULL,
  createdAt         DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt         DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_number (companyId, adjustmentNumber),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Detail Penyesuaian Stok ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
  id            VARCHAR(36)   PRIMARY KEY,
  adjustmentId  VARCHAR(36)   NOT NULL,
  productId     VARCHAR(36)   NOT NULL,
  systemQty     DOUBLE        NOT NULL,
  actualQty     DOUBLE        NOT NULL,
  difference    DOUBLE        NOT NULL,
  unitCost      DOUBLE        NOT NULL DEFAULT 0,
  sortOrder     INT           NOT NULL DEFAULT 0,
  FOREIGN KEY (adjustmentId) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
