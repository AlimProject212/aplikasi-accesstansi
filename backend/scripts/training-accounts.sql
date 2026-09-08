-- ================================================================
-- AccessTansi: 15 Training Companies + Users
-- Jalankan di phpMyAdmin → tab SQL
-- ================================================================

-- STEP 1: Buat 15 company training
INSERT INTO companies (id, name, slug, code, ownerEmail, plan, isActive, createdAt) VALUES
(100, 'Training 001', 'latih001', 'LATIH001', 'latih001@accesstansi.id', 'FREE', 1, NOW()),
(101, 'Training 002', 'latih002', 'LATIH002', 'latih002@accesstansi.id', 'FREE', 1, NOW()),
(102, 'Training 003', 'latih003', 'LATIH003', 'latih003@accesstansi.id', 'FREE', 1, NOW()),
(103, 'Training 004', 'latih004', 'LATIH004', 'latih004@accesstansi.id', 'FREE', 1, NOW()),
(104, 'Training 005', 'latih005', 'LATIH005', 'latih005@accesstansi.id', 'FREE', 1, NOW()),
(105, 'Training 006', 'latih006', 'LATIH006', 'latih006@accesstansi.id', 'FREE', 1, NOW()),
(106, 'Training 007', 'latih007', 'LATIH007', 'latih007@accesstansi.id', 'FREE', 1, NOW()),
(107, 'Training 008', 'latih008', 'LATIH008', 'latih008@accesstansi.id', 'FREE', 1, NOW()),
(108, 'Training 009', 'latih009', 'LATIH009', 'latih009@accesstansi.id', 'FREE', 1, NOW()),
(109, 'Training 010', 'latih010', 'LATIH010', 'latih010@accesstansi.id', 'FREE', 1, NOW()),
(110, 'Training 011', 'latih011', 'LATIH011', 'latih011@accesstansi.id', 'FREE', 1, NOW()),
(111, 'Training 012', 'latih012', 'LATIH012', 'latih012@accesstansi.id', 'FREE', 1, NOW()),
(112, 'Training 013', 'latih013', 'LATIH013', 'latih013@accesstansi.id', 'FREE', 1, NOW()),
(113, 'Training 014', 'latih014', 'LATIH014', 'latih014@accesstansi.id', 'FREE', 1, NOW()),
(114, 'Training 015', 'latih015', 'LATIH015', 'latih015@accesstansi.id', 'FREE', 1, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code);

-- STEP 2: Buat profil company
INSERT INTO company_profile (id, name, address, city, phone, email, updatedAt) VALUES
(100, 'Training 001', '', '', '', 'latih001@accesstansi.id', NOW()),
(101, 'Training 002', '', '', '', 'latih002@accesstansi.id', NOW()),
(102, 'Training 003', '', '', '', 'latih003@accesstansi.id', NOW()),
(103, 'Training 004', '', '', '', 'latih004@accesstansi.id', NOW()),
(104, 'Training 005', '', '', '', 'latih005@accesstansi.id', NOW()),
(105, 'Training 006', '', '', '', 'latih006@accesstansi.id', NOW()),
(106, 'Training 007', '', '', '', 'latih007@accesstansi.id', NOW()),
(107, 'Training 008', '', '', '', 'latih008@accesstansi.id', NOW()),
(108, 'Training 009', '', '', '', 'latih009@accesstansi.id', NOW()),
(109, 'Training 010', '', '', '', 'latih010@accesstansi.id', NOW()),
(110, 'Training 011', '', '', '', 'latih011@accesstansi.id', NOW()),
(111, 'Training 012', '', '', '', 'latih012@accesstansi.id', NOW()),
(112, 'Training 013', '', '', '', 'latih013@accesstansi.id', NOW()),
(113, 'Training 014', '', '', '', 'latih014@accesstansi.id', NOW()),
(114, 'Training 015', '', '', '', 'latih015@accesstansi.id', NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- STEP 3: Buat konfigurasi app
INSERT INTO app_config (id, lockDate, fiscalYearStartMonth, activePeriod, onboardingCompleted, updatedAt) VALUES
(100, '', 1, '', 1, NOW()),
(101, '', 1, '', 1, NOW()),
(102, '', 1, '', 1, NOW()),
(103, '', 1, '', 1, NOW()),
(104, '', 1, '', 1, NOW()),
(105, '', 1, '', 1, NOW()),
(106, '', 1, '', 1, NOW()),
(107, '', 1, '', 1, NOW()),
(108, '', 1, '', 1, NOW()),
(109, '', 1, '', 1, NOW()),
(110, '', 1, '', 1, NOW()),
(111, '', 1, '', 1, NOW()),
(112, '', 1, '', 1, NOW()),
(113, '', 1, '', 1, NOW()),
(114, '', 1, '', 1, NOW())
ON DUPLICATE KEY UPDATE id=id;

-- STEP 4: Buat user admin untuk tiap company
INSERT INTO users (companyId, name, email, passwordHash, role, canManageUsers, canManageSettings, canManageCOA, canEntryJournal, canApproveJournal, canDeleteJournal, canViewReports, isActive, loginAttempts, createdAt, updatedAt) VALUES
(100, 'Peserta Training 001', 'latih001@accesstansi.id', '$2a$12$l.1omX19kqCM/3J0Oma0a.zbmNMrJ/wgsGNf0KoFB0aFa4UO4yxq6', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(101, 'Peserta Training 002', 'latih002@accesstansi.id', '$2a$12$OGI8npNyjYIVfCv598OzgeUlJ69haGpP9UOjwxEn9quZqqdFyNt.S', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(102, 'Peserta Training 003', 'latih003@accesstansi.id', '$2a$12$QHiL8PIyh5Yd/6JgJCtAaeeKCq2.m9C9Q.qAjktPVWHPbATJIVWl6', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(103, 'Peserta Training 004', 'latih004@accesstansi.id', '$2a$12$QgIbp.utRT3uBRPpgHI5IeVlyY1RrLg41BLxmQQwmxGwfpG8D1Q/C', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(104, 'Peserta Training 005', 'latih005@accesstansi.id', '$2a$12$PTX95TwKrXqeYKs89u9RL.p00JinoTaANC6RrM3xfd798.lofceca', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(105, 'Peserta Training 006', 'latih006@accesstansi.id', '$2a$12$ZAtkIi6GMIqLGu49tBhZ2e5cVALhvdbBu1oy0v.GkyBVw8m2dhrPG', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(106, 'Peserta Training 007', 'latih007@accesstansi.id', '$2a$12$BRAMyK11knd42edE1oA82emnEBU3SCET14xgIB6QqvWOw94km8YDm', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(107, 'Peserta Training 008', 'latih008@accesstansi.id', '$2a$12$Ws7Pj8S/NjNNgb/99QjVV.NMKc2H7wiVWVFTSCJ/mlAD7.22Fm6DW', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(108, 'Peserta Training 009', 'latih009@accesstansi.id', '$2a$12$C5bSco7YB7yEq9MESgBPKecVuUXN774X/K7UxidqZCapP3uNBOCIW', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(109, 'Peserta Training 010', 'latih010@accesstansi.id', '$2a$12$yHT5W2GPsEYqTkhKl8IG8eeHX1oTWDMgFOpDi6cNO7FaPaPzTdKaW', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(110, 'Peserta Training 011', 'latih011@accesstansi.id', '$2a$12$pDf7blz0wCqlny7Es7FTDeP31kuwXFWypsv5uTUuKMm1ANAqHHqEu', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(111, 'Peserta Training 012', 'latih012@accesstansi.id', '$2a$12$aXUhCxCVQz.wiP5AGirO6eB180UcA/N3a8wQTUkQTdwJH7kmq7qUC', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(112, 'Peserta Training 013', 'latih013@accesstansi.id', '$2a$12$Gu2YkMm0VjSJyAzc9wlL5OY2swtiMphfX40lk.WoNa5R2xh0aENia', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(113, 'Peserta Training 014', 'latih014@accesstansi.id', '$2a$12$JMBsRGj3o/UP3fVcB/289eFAsIAU6LAwKkWs0OBC0NJnRgw/PH02S', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW()),
(114, 'Peserta Training 015', 'latih015@accesstansi.id', '$2a$12$PwvOlUi0ZLNVFNg9h.Qd9uAixm6qD7EXNPWEjGdyx/I/EtDcKM8We', 'ADMIN', 1,1,1,1,1,1,1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE passwordHash=VALUES(passwordHash), companyId=VALUES(companyId), role='ADMIN', isActive=1;

-- SELESAI! 15 company + 15 user training siap digunakan.
-- Login: Company ID = LATIH001 s/d LATIH015
--        Email      = latih001@accesstansi.id s/d latih015@accesstansi.id
--        Password   = LATIH001 s/d LATIH015
