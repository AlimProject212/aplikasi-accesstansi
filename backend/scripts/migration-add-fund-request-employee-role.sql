-- Migration: tambah kolom employeeRole di fund_requests
-- Jalankan di phpMyAdmin sebelum deploy backend baru
-- Dipakai untuk mengisi otomatis field "Jabatan" di formulir cetak Permohonan Uang Muka

ALTER TABLE `fund_requests`
  ADD COLUMN `employeeRole` VARCHAR(100) DEFAULT NULL AFTER `employeeName`;
