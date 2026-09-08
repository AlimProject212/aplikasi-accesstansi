<?php
/**
 * AccessTansi — Seed Admin Script
 * ================================
 * Upload file ini ke Rumah Web (public_html atau folder tersembunyi).
 * Akses via browser: https://domain.com/seed_admin.php
 * Setelah berhasil, HAPUS file ini dari server!
 *
 * Cara pakai:
 * 1. Isi 4 variabel di bawah sesuai setting MySQL Rumah Web
 * 2. Upload ke server
 * 3. Buka di browser
 * 4. Hapus file ini
 */

// ─── KONFIGURASI DATABASE ────────────────────────────────────────────────────
$DB_HOST = 'localhost';          // biasanya 'localhost' di Rumah Web
$DB_NAME = 'accj7125_accesstansi'; // nama database yang sudah dibuat di cPanel
$DB_USER = 'accj7125_admin'; // username database dari cPanel
$DB_PASS = '*7KurXhSyNj2Xcb';  // password database dari cPanel
// ─────────────────────────────────────────────────────────────────────────────

// Keamanan: cek apakah diakses dari IP tertentu (opsional, hapus kalau ribet)
// $allowed_ip = '1.2.3.4';
// if ($_SERVER['REMOTE_ADDR'] !== $allowed_ip) die('403 Forbidden');

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>AccessTansi - Seed Admin</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 2rem; }
    .ok  { color: #4ade80; }
    .err { color: #f87171; }
    .warn{ color: #fbbf24; }
    pre  { background: #16213e; padding: 1rem; border-radius: 8px; }
  </style>
</head>
<body>
<h2>🌱 AccessTansi — Seed Admin</h2>
<pre>
<?php

try {
    // ─── Koneksi Database ─────────────────────────────────────────────────────
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "<span class='ok'>✅ Koneksi database berhasil</span>\n\n";

    $year = date('Y');

    // ─── 1. Admin User ────────────────────────────────────────────────────────
    // password_hash PHP kompatibel dengan bcryptjs Node.js
    $passwordHash = password_hash('admin123', PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $pdo->prepare("
        INSERT INTO `users`
          (`name`, `email`, `passwordHash`, `role`, `isActive`, `updatedAt`,
           `canManageUsers`, `canManageSettings`, `canManageCOA`,
           `canEntryJournal`, `canApproveJournal`, `canDeleteJournal`, `canViewReports`)
        VALUES
          ('Administrator', 'admin@accesstansi.com', ?, 'SUPERADMIN', 1, NOW(),
           1, 1, 1, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE `id` = `id`
    ");
    $stmt->execute([$passwordHash]);

    if ($stmt->rowCount() > 0) {
        echo "<span class='ok'>✅ User admin dibuat</span>\n";
    } else {
        echo "<span class='warn'>⚠️  User admin sudah ada (skip)</span>\n";
    }

    // ─── 2. Company Profile (singleton id=1) ──────────────────────────────────
    $pdo->exec("
        INSERT INTO `company_profile`
          (`id`, `name`, `address`, `city`, `phone`, `email`, `updatedAt`)
        VALUES
          (1, 'Perusahaan Saya', '', '', '', '', NOW())
        ON DUPLICATE KEY UPDATE `id` = `id`
    ");
    echo "<span class='ok'>✅ Company profile dibuat</span>\n";

    // ─── 3. App Config (singleton id=1) ───────────────────────────────────────
    $stmt2 = $pdo->prepare("
        INSERT INTO `app_config`
          (`id`, `lockDate`, `fiscalYearStartMonth`, `activePeriod`, `updatedAt`)
        VALUES
          (1, '', 1, ?, NOW())
        ON DUPLICATE KEY UPDATE `id` = `id`
    ");
    $stmt2->execute([$year]);
    echo "<span class='ok'>✅ App config dibuat (tahun aktif: {$year})</span>\n";

    // ─── 4. Fiscal Year ───────────────────────────────────────────────────────
    $stmt3 = $pdo->prepare("
        INSERT INTO `fiscal_years` (`year`, `isActive`)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE `id` = `id`
    ");
    $stmt3->execute([$year]);
    echo "<span class='ok'>✅ Fiscal year {$year} dibuat</span>\n";

    // ─── Ringkasan ────────────────────────────────────────────────────────────
    echo "\n";
    echo "══════════════════════════════════════════\n";
    echo "<span class='ok'>🎉 Seed selesai!</span>\n";
    echo "══════════════════════════════════════════\n";
    echo "\n";
    echo "🔑 Login Credentials:\n";
    echo "   Email   : admin@accesstansi.com\n";
    echo "   Password: admin123\n";
    echo "\n";
    echo "<span class='warn'>⚠️  PENTING: Hapus file seed_admin.php dari server sekarang!</span>\n";
    echo "<span class='warn'>⚠️  Ganti password setelah login pertama!</span>\n";

} catch (PDOException $e) {
    echo "<span class='err'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</span>\n";
    echo "\n";
    echo "<span class='warn'>Kemungkinan penyebab:</span>\n";
    echo "  - Nama database/user/password salah\n";
    echo "  - Tabel belum dibuat (import schema.sql dulu via phpMyAdmin)\n";
    echo "  - Host tidak tepat (coba ubah localhost ke 127.0.0.1)\n";
}
?>
</pre>
</body>
</html>
