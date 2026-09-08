-- Auto-setup Akun Jurnal Otomatis untuk Modul Persediaan & Dagang — Company 1
-- (AccessTansi / STAI-ASTA)
--
-- Dibuat berdasarkan hasil cek COA company 1 dari dump SQL produksi: COA yang
-- ada sekarang adalah template institusi pendidikan (Piutang Mahasiswa,
-- Pendapatan SPP/PMB, dst) — TIDAK ada akun Hutang Usaha/Piutang Usaha (dagang)/
-- Pendapatan Penjualan/HPP/PPN Keluaran/Selisih Stok. Semua akun baru di bawah
-- ini SENGAJA dibuat terpisah (kode 771xxxxx, belum pernah dipakai) supaya
-- TIDAK menyentuh/nyampur akun pendidikan yang sudah ada.
--
-- PERINGATAN: bagian ke-2 (UPDATE inventory_settings) akan MENIMPA pengaturan
-- akun yang mungkin sudah pernah diisi manual sebelumnya lewat UI. Kalau sudah
-- pernah setting manual dan mau dipertahankan, jangan jalankan script ini —
-- edit manual aja lewat menu Kartu Stok & Opname > Pengaturan Akun.
--
-- Aman dijalankan cuma SEKALI (kalau dijalankan 2x, akan bikin akun duplikat
-- karena tidak ada pengecekan existing).

SET @companyId = 1;

-- ─── 1. Buat 7 akun baru khusus modul dagang ──────────────────────────────────
SET @accPersediaan   = UUID();
SET @accPiutangUsaha = UUID();
SET @accHutangUsaha  = UUID();
SET @accPendapatan   = UUID();
SET @accHPP          = UUID();
SET @accPPNKeluaran  = UUID();
SET @accSelisihStok  = UUID();

INSERT INTO accounts (id, companyId, code, name, type, level, parentId, balance, isHeader, cashFlowCategory, createdAt, updatedAt) VALUES
(@accPersediaan,   @companyId, '77100000', 'Persediaan Barang Dagang',           'ASSET',     1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accPiutangUsaha, @companyId, '77200000', 'Piutang Usaha (Dagang)',             'ASSET',     1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accHutangUsaha,  @companyId, '77300000', 'Hutang Usaha (Dagang)',              'LIABILITY', 1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accPendapatan,   @companyId, '77400000', 'Pendapatan Penjualan Barang Dagang', 'REVENUE',   1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accHPP,          @companyId, '77500000', 'Harga Pokok Penjualan (HPP)',        'EXPENSE',   1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accPPNKeluaran,  @companyId, '77600000', 'PPN Keluaran',                       'LIABILITY', 1, NULL, 0, 0, 'OPERATING', NOW(), NOW()),
(@accSelisihStok,  @companyId, '77700000', 'Beban Selisih Stok',                 'EXPENSE',   1, NULL, 0, 0, 'OPERATING', NOW(), NOW());

-- ─── 2. Wire otomatis ke Pengaturan Persediaan ────────────────────────────────
-- Akun Kas/Bank di bawah REUSE akun yang sudah ada (bukan bikin baru):
--   posCashAccountId     -> Kas Operasional        (1772595035423-0)
--   posTransferAccountId -> Bank Syariah Indonesia  (1772595035423-11)
--   posQrisAccountId     -> Bank Syariah Indonesia  (1772595035423-11)
--   posCardAccountId     -> Bank BRI                (1772595035423-12)
-- Ganti ID di bawah kalau mau pakai akun kas/bank yang lain.

INSERT INTO inventory_settings (
  id, inventoryAccountId, stockAdjustmentAccountId, payableAccountId,
  receivableAccountId, salesRevenueAccountId, cogsAccountId, salesTaxAccountId,
  posCashAccountId, posTransferAccountId, posQrisAccountId, posCardAccountId
) VALUES (
  @companyId, @accPersediaan, @accSelisihStok, @accHutangUsaha,
  @accPiutangUsaha, @accPendapatan, @accHPP, @accPPNKeluaran,
  '1772595035423-0', '1772595035423-11', '1772595035423-11', '1772595035423-12'
)
ON DUPLICATE KEY UPDATE
  inventoryAccountId       = VALUES(inventoryAccountId),
  stockAdjustmentAccountId = VALUES(stockAdjustmentAccountId),
  payableAccountId         = VALUES(payableAccountId),
  receivableAccountId      = VALUES(receivableAccountId),
  salesRevenueAccountId    = VALUES(salesRevenueAccountId),
  cogsAccountId             = VALUES(cogsAccountId),
  salesTaxAccountId        = VALUES(salesTaxAccountId),
  posCashAccountId         = VALUES(posCashAccountId),
  posTransferAccountId     = VALUES(posTransferAccountId),
  posQrisAccountId         = VALUES(posQrisAccountId),
  posCardAccountId         = VALUES(posCardAccountId);
