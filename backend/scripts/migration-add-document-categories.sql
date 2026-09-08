-- Migration: tambah tabel document_categories + ubah kolom category di audit_documents
-- Jalankan di phpMyAdmin sebelum deploy backend/frontend baru

-- 1. Ubah kolom category dari ENUM ke VARCHAR agar bisa terima kategori kustom
ALTER TABLE `audit_documents`
  MODIFY COLUMN `category` VARCHAR(100) NOT NULL;

-- 2. Buat tabel document_categories
CREATE TABLE IF NOT EXISTS `document_categories` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `companyId`   INT NOT NULL DEFAULT 1,
  `label`       VARCHAR(100) NOT NULL,
  `categoryKey` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `isDefault`   TINYINT(1) NOT NULL DEFAULT 0,
  `sortOrder`   INT NOT NULL DEFAULT 0,
  `createdAt`   DATETIME NOT NULL DEFAULT NOW(),
  `updatedAt`   DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uniq_company_key` (`companyId`, `categoryKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catatan:
-- Kategori default akan di-seed otomatis oleh backend saat pertama kali
-- endpoint GET /api/doc-categories dipanggil (jika belum ada data untuk company tersebut).
-- Data audit_documents yang sudah ada tetap valid karena key-nya ('LEGAL', 'FINANCE', dll)
-- sama dengan yang akan di-seed.
