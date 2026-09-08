-- Migration: tambah tabel bank_statement_keywords (kamus belajar kategori COA
-- untuk fitur Import Rekening Koran)
-- Jalankan di phpMyAdmin sebelum deploy backend/frontend baru

CREATE TABLE IF NOT EXISTS `bank_statement_keywords` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `companyId`  INT NOT NULL DEFAULT 1,
  `accountId`  VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `keyword`    VARCHAR(255) NOT NULL,
  `matchCount` INT NOT NULL DEFAULT 1,
  `updatedAt`  DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uniq_company_keyword` (`companyId`, `keyword`),
  CONSTRAINT `fk_bank_statement_keywords_account`
    FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catatan:
-- Kamus ini diisi otomatis oleh backend (POST /api/bank-statements/keywords/reinforce)
-- setiap kali user mem-posting hasil import rekening koran dan memilih/mengonfirmasi
-- akun COA untuk sebuah transaksi. Tidak perlu di-seed manual.
