-- Migration: Modul Persediaan & Dagang — Fase 0 (Fondasi)
-- Jalankan manual di phpMyAdmin sebelum deploy backend baru.
-- Aman dijalankan ulang (IF NOT EXISTS / try-catch ALTER via kolom cek manual).

-- ─── Kategori Barang ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id         INT           PRIMARY KEY AUTO_INCREMENT,
  companyId  INT           NOT NULL DEFAULT 1,
  name       VARCHAR(255)  NOT NULL,
  createdAt  DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt  DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_name (companyId, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Satuan Barang ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id            INT           PRIMARY KEY AUTO_INCREMENT,
  companyId     INT           NOT NULL DEFAULT 1,
  name          VARCHAR(100)  NOT NULL,
  abbreviation  VARCHAR(20)   NOT NULL,
  createdAt     DATETIME      NOT NULL DEFAULT NOW(),
  UNIQUE KEY uniq_company_name (companyId, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Gudang ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id         INT           PRIMARY KEY AUTO_INCREMENT,
  companyId  INT           NOT NULL DEFAULT 1,
  name       VARCHAR(255)  NOT NULL,
  address    TEXT          NULL,
  isDefault  TINYINT(1)    NOT NULL DEFAULT 0,
  isActive   TINYINT(1)    NOT NULL DEFAULT 1,
  createdAt  DATETIME      NOT NULL DEFAULT NOW(),
  UNIQUE KEY uniq_company_name (companyId, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Master Barang Dagang ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             VARCHAR(36)   PRIMARY KEY,
  companyId      INT           NOT NULL DEFAULT 1,
  sku            VARCHAR(100)  NOT NULL,
  barcode        VARCHAR(100)  NULL,
  name           VARCHAR(255)  NOT NULL,
  categoryId     INT           NULL,
  unitId         INT           NULL,
  purchasePrice  DOUBLE        NOT NULL DEFAULT 0,
  sellPrice      DOUBLE        NOT NULL DEFAULT 0,
  minStock       DOUBLE        NOT NULL DEFAULT 0,
  currentStock   DOUBLE        NOT NULL DEFAULT 0,
  avgCost        DOUBLE        NOT NULL DEFAULT 0,
  isActive       TINYINT(1)    NOT NULL DEFAULT 1,
  createdAt      DATETIME      NOT NULL DEFAULT NOW(),
  updatedAt      DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uniq_company_sku (companyId, sku),
  KEY idx_product_barcode (barcode),
  KEY idx_product_name (name),
  FOREIGN KEY (categoryId) REFERENCES product_categories(id),
  FOREIGN KEY (unitId) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Permission baru di tabel users ──────────────────────────────────────────────
-- Jalankan satu-satu; abaikan error "Duplicate column name" jika sudah pernah dijalankan.
ALTER TABLE users ADD COLUMN canManageInventory    TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN canManagePurchasing   TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN canManageSales        TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN canOperatePOS         TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN canVoidPOSTransaction TINYINT(1) NOT NULL DEFAULT 0;

-- Beri SUPERADMIN & ADMIN akses penuh modul baru secara default (biar tidak perlu setting ulang manual)
UPDATE users SET
  canManageInventory = 1,
  canManagePurchasing = 1,
  canManageSales = 1,
  canOperatePOS = 1,
  canVoidPOSTransaction = 1
WHERE role IN ('SUPERADMIN', 'ADMIN');

-- ─── Registrasi Add-on Module baru ────────────────────────────────────────────────
INSERT IGNORE INTO addon_modules (id, name, slug, description, priceMonthly) VALUES
(3, 'Persediaan & Dagang', 'persediaan-dagang', 'Master barang, kartu stok, pembelian (PO & penerimaan barang), faktur penjualan, dan Point of Sales (POS)', 99000);
