-- ================================================================
-- AccessTansi: UPDATE kode company training ke format LATIH-001
-- ================================================================

-- STEP 1: Update kode company (LATIH001 → LATIH-001)
UPDATE companies SET code = 'LATIH-001', slug = 'latih-001' WHERE id = 100;
UPDATE companies SET code = 'LATIH-002', slug = 'latih-002' WHERE id = 101;
UPDATE companies SET code = 'LATIH-003', slug = 'latih-003' WHERE id = 102;
UPDATE companies SET code = 'LATIH-004', slug = 'latih-004' WHERE id = 103;
UPDATE companies SET code = 'LATIH-005', slug = 'latih-005' WHERE id = 104;
UPDATE companies SET code = 'LATIH-006', slug = 'latih-006' WHERE id = 105;
UPDATE companies SET code = 'LATIH-007', slug = 'latih-007' WHERE id = 106;
UPDATE companies SET code = 'LATIH-008', slug = 'latih-008' WHERE id = 107;
UPDATE companies SET code = 'LATIH-009', slug = 'latih-009' WHERE id = 108;
UPDATE companies SET code = 'LATIH-010', slug = 'latih-010' WHERE id = 109;
UPDATE companies SET code = 'LATIH-011', slug = 'latih-011' WHERE id = 110;
UPDATE companies SET code = 'LATIH-012', slug = 'latih-012' WHERE id = 111;
UPDATE companies SET code = 'LATIH-013', slug = 'latih-013' WHERE id = 112;
UPDATE companies SET code = 'LATIH-014', slug = 'latih-014' WHERE id = 113;
UPDATE companies SET code = 'LATIH-015', slug = 'latih-015' WHERE id = 114;

-- STEP 2: Update password user (password baru = LATIH-001 dst)
UPDATE users SET passwordHash = '$2a$12$mshhw8jfmlcrKH1wL88uDuoS/.ZDHmAjFG7Gc8vZg9YFjF/Fex/xS' WHERE email = 'latih001@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$yGLpjDAAo9eg5KuOwxL86.eClw1h3vmZdKz5VW3O5faj4OWyDIOrK' WHERE email = 'latih002@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$DDFHPV3h5179UXLLtkdlzuNbfJcUNf5fnhkXM/.dJCDYIQSAzKSIa' WHERE email = 'latih003@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$edMiFya6fVoerqXeHVdB0.khwFeCRQ0s43.ERmbSATGcPJ6EzEDU2' WHERE email = 'latih004@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$Y0FVlECfeu/P2ceFUmsB8uG6nroghtkbCZmCz/QI59T1jChWhZxvu' WHERE email = 'latih005@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$XCFsd5lTi7DmFMP/8MAzR.s1SPSzR/Ktkb9F2sIRvkGofg4MTEmJu' WHERE email = 'latih006@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$NFJHLv3cMu8blQI5PiHIseK7RN6yRJn8BEGn0ZRU3aPDAvCkkSPJq' WHERE email = 'latih007@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$GmChLrI0qmJO1e6nwgzkieWKcf8F7.btPn8zpIQZnzkQsiAPScTQy' WHERE email = 'latih008@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$M//5wUhjNdq9PB9Bis0pdu0UxSKoC72sraYSXr6sc9Qd/WJ8XwW8.' WHERE email = 'latih009@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$7x2SpRKrKa9oSs967B3D4.j5uuuf27uzSqe.ekMcpFOVIkSgq2VZ6' WHERE email = 'latih010@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$tQByLW89nQERpQYx3UDJJOHclfs3lQqs.ehzZLLZfSkbMZrgXMTWC' WHERE email = 'latih011@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$JZusbs/megIf5sqNDySPKuMA7B2C2M4SmG.yJn2uL1nlF5dt4lwtu' WHERE email = 'latih012@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$KWvtcCrkv1tmymg50P9KC.jNC8N6NIwGH45YO8zf6JlbK9beagdOO' WHERE email = 'latih013@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$A.0nVJjVKqBJ8/Hj23eRY.4ixrakdMBw.OFe8wu/0Auqjnmtkufua' WHERE email = 'latih014@accesstansi.id';
UPDATE users SET passwordHash = '$2a$12$sNakBekvZlxqmODCpN0sR.5ZeIpdxOjgUe3WJSVIoCEJFL.409zbi' WHERE email = 'latih015@accesstansi.id';

-- SELESAI!
-- Login: Company ID = LATIH-001 s/d LATIH-015
--        Email      = latih001@accesstansi.id s/d latih015@accesstansi.id
--        Password   = LATIH-001 s/d LATIH-015
