-- Migration: Modul Persediaan & Dagang — Fase 2 (Purchase Order & Penerimaan Barang)
-- Jalankan manual di phpMyAdmin SETELAH migration-add-inventory-module.sql (Fase 0)
-- dan migration-add-stock-engine.sql (Fase 1).
--
-- Catatan: FOREIGN KEY ke tabel lama (accounts, contacts, users) sengaja TIDAK
-- dipasang — lihat catatan di migration-add-stock-engine.sql soal errno 150.

-- ─── Tambah akun Hutang Usaha ke Pengaturan Persediaan ──────────────────────────
ALTER TABLE inventory_settings ADD COLUMN payableAccountId VARCHAR(36) NULL;

-- ─── Purchase Order ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            VARCHAR(36)   PRIMARY KEY,
  companyId     INT           NOT NULL DEFAULT 1,
  poNumber      VARCHAR(255)  NOT NULL,
  vendorId      VARCHAR(36)   NOT NULL,
  orderDate     DATETIME      NOT NULL,
  expectedDate  DATETIME      NULL,
  status        ENUM('DRAFT','ORDERED','PARTIAL','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  notes         TEXT          NULL,
  createdById   INT           NOT NULL,
  createdAt     DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt     DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_number (companyId, poNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Purchase Order Lines ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id           VARCHAR(36)  PRIMARY KEY,
  poId         VARCHAR(36)  NOT NULL,
  productId    VARCHAR(36)  NOT NULL,
  qtyOrdered   DOUBLE       NOT NULL,
  qtyReceived  DOUBLE       NOT NULL DEFAULT 0,
  unitPrice    DOUBLE       NOT NULL DEFAULT 0,
  sortOrder    INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (poId) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Penerimaan Barang ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipts (
  id              VARCHAR(36)   PRIMARY KEY,
  companyId       INT           NOT NULL DEFAULT 1,
  receiptNumber   VARCHAR(255)  NOT NULL,
  poId            VARCHAR(36)   NULL,
  vendorId        VARCHAR(36)   NOT NULL,
  warehouseId     INT           NULL,
  receiptDate     DATETIME      NOT NULL,
  status          ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
  totalAmount     DOUBLE        NOT NULL DEFAULT 0,
  paidAmount      DOUBLE        NOT NULL DEFAULT 0,
  journalEntryId  VARCHAR(36)   NULL,
  notes           TEXT          NULL,
  createdById     INT           NOT NULL,
  createdAt       DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_number (companyId, receiptNumber),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Detail Penerimaan Barang ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id          VARCHAR(36)  PRIMARY KEY,
  receiptId   VARCHAR(36)  NOT NULL,
  productId   VARCHAR(36)  NOT NULL,
  qty         DOUBLE       NOT NULL,
  unitCost    DOUBLE       NOT NULL,
  sortOrder   INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (receiptId) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Pembayaran Hutang ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_payments (
  id              VARCHAR(36)   PRIMARY KEY,
  companyId       INT           NOT NULL DEFAULT 1,
  receiptId       VARCHAR(36)   NOT NULL,
  paymentDate     DATETIME      NOT NULL,
  amount          DOUBLE        NOT NULL,
  accountId       VARCHAR(36)   NOT NULL,
  journalEntryId  VARCHAR(36)   NULL,
  notes           TEXT          NULL,
  createdById     INT           NOT NULL,
  createdAt       DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (receiptId) REFERENCES goods_receipts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
