-- ============================================================
-- MIGRATION: Tambah kolom account lockout ke tabel users
-- Jalankan sekali di phpMyAdmin / MySQL console
-- ============================================================

-- Tambah kolom loginAttempts (default 0)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS loginAttempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lockedUntil   DATETIME NULL DEFAULT NULL;

-- Verifikasi
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('loginAttempts', 'lockedUntil');
