-- Migration: Grandfather akses add-on lama sebelum gating di-enforce
-- WAJIB dijalankan SEBELUM upload backend baru yang memasang requireAddon()
-- ke route fundRequests/docGroups/docCategories/auditDocs.
--
-- Alasan: table company_addons masih kosong total, padahal dari cek dump SQL
-- produksi ada company yang SUDAH pakai fitur ini beneran (bukan cuma testing):
--   - Manajemen Dana (moduleId 1)    : companyId 1, 102
--   - Repository Dokumen (moduleId 2): companyId 1, 7, 102, 115
-- Tanpa ini, company-company tsb bakal langsung kehilangan akses begitu
-- backend baru live.

INSERT IGNORE INTO company_addons (companyId, moduleId, status, startDate, endDate) VALUES
(1,   1, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
(102, 1, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
(1,   2, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
(7,   2, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
(102, 2, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
(115, 2, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR)),
-- Company 1 = company sendiri (AccessTansi/default) — buka SEMUA add-on termasuk yang baru
(1,   3, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 YEAR));

-- Catatan: kalau nanti mau nagih beneran ke company 7 & 115 untuk Repository
-- Dokumen (karena mereka pakai dokumen bisnis asli), ini query buat cek data
-- mereka masih ada & OK dulu sebelum ubah endDate jadi lebih pendek/nagih beneran:
--   SELECT * FROM audit_documents WHERE companyId IN (7, 115);
