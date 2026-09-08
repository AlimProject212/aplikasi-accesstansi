import 'dotenv/config';
import { createApp } from './app';
import { pool } from './lib/prisma';

const PORT = Number(process.env.PORT) || 4000;

const app = createApp();

/** Auto-migration: tambah kolom baru tanpa DROP data lama */
async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    // ── MULTI-TENANT Step 1: Create companies table ─────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id          INT           PRIMARY KEY AUTO_INCREMENT,
        name        VARCHAR(255)  NOT NULL,
        slug        VARCHAR(100)  NOT NULL UNIQUE,
        ownerEmail  VARCHAR(255)  NOT NULL,
        plan        ENUM('FREE','PRO','ENTERPRISE') NOT NULL DEFAULT 'FREE',
        isActive    TINYINT(1)    NOT NULL DEFAULT 1,
        createdAt   DATETIME      NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── MULTI-TENANT Step 2: Seed default company (existing data = companyId 1) ─
    // Tanpa kolom 'code' karena kolom itu baru ditambahkan di bagian akhir migration
    await conn.query(`
      INSERT IGNORE INTO companies (id, name, slug, ownerEmail, plan)
      VALUES (1, 'AccessTansi', 'default', 'admin@accesstansi.id', 'FREE')
    `);

    // ── MULTI-TENANT Step 3: Add companyId to all main tables (DEFAULT 1) ──────
    const multiTenantTables = [
      'users', 'fiscal_years', 'accounts', 'contacts',
      'account_budgets', 'journal_entries', 'api_configs',
      'audit_documents', 'fund_requests',
    ];
    for (const tbl of multiTenantTables) {
      await conn.query(
        `ALTER TABLE \`${tbl}\` ADD COLUMN IF NOT EXISTS companyId INT NOT NULL DEFAULT 1`
      ).catch(() =>
        conn.query(
          `ALTER TABLE \`${tbl}\` ADD COLUMN companyId INT NOT NULL DEFAULT 1`
        ).catch(() => {})
      );
    }

    // ── MULTI-TENANT Step 4: Replace old single-column uniques with composites ──
    // Try to drop old unique constraints (various naming patterns from Drizzle)
    const oldConstraints: [string, string][] = [
      ['accounts',        'accounts_code_unique'],
      ['accounts',        'accounts_code_key'],   // ← nama index MySQL lama
      ['accounts',        'code'],
      ['journal_entries', 'journal_entries_referenceNumber_unique'],
      ['journal_entries', 'journal_entries_referenceNumber_key'],
      ['journal_entries', 'referenceNumber'],
      ['fiscal_years',    'fiscal_years_year_unique'],
      ['fiscal_years',    'fiscal_years_year_key'],
      ['fiscal_years',    'year'],
    ];
    for (const [tbl, idx] of oldConstraints) {
      await conn.query(`ALTER TABLE \`${tbl}\` DROP INDEX \`${idx}\``).catch(() => {});
    }
    // Add composite unique constraints
    await conn.query(`ALTER TABLE accounts ADD UNIQUE INDEX uniq_code_company (code, companyId)`).catch(() => {});
    await conn.query(`ALTER TABLE journal_entries ADD UNIQUE INDEX uniq_ref_company (referenceNumber, companyId)`).catch(() => {});
    await conn.query(`ALTER TABLE fiscal_years ADD UNIQUE INDEX uniq_year_company (year, companyId)`).catch(() => {});

    // ── Existing migrations ──────────────────────────────────────────────────────
    // company_profile: signerName + signerTitle (tambah jika belum ada)
    await conn.query(`
      ALTER TABLE company_profile
        ADD COLUMN IF NOT EXISTS signerName  VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS signerTitle VARCHAR(255) NULL
    `).catch(() => {
      // MySQL < 8.0 tidak support ADD COLUMN IF NOT EXISTS → fallback manual
      return Promise.all([
        conn.query(`ALTER TABLE company_profile ADD COLUMN signerName  VARCHAR(255) NULL`).catch(() => {}),
        conn.query(`ALTER TABLE company_profile ADD COLUMN signerTitle VARCHAR(255) NULL`).catch(() => {}),
      ]);
    });

    // audit_documents table (buat jika belum ada)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_documents (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        companyId   INT             NOT NULL DEFAULT 1,
        name        VARCHAR(255)    NOT NULL,
        category    ENUM('LEGAL','FINANCE','TAX','OPERATIONAL','OTHER') NOT NULL,
        year        VARCHAR(10)     NOT NULL,
        status      ENUM('RED','YELLOW','GREEN') NOT NULL DEFAULT 'YELLOW',
        uploadedBy  VARCHAR(255)    NULL,
        fileSize    VARCHAR(50)     NULL,
        filePath    VARCHAR(500)    NOT NULL,
        mimeType    VARCHAR(100)    NULL,
        journalRef  VARCHAR(100)    NULL,
        createdAt   DATETIME        NOT NULL DEFAULT NOW(),
        updatedAt   DATETIME        NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // fund_requests table (buat jika belum ada)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fund_requests (
        id                          VARCHAR(36)   PRIMARY KEY,
        companyId                   INT           NOT NULL DEFAULT 1,
        employeeId                  VARCHAR(255)  NOT NULL,
        employeeName                VARCHAR(255)  NOT NULL,
        \`date\`                    VARCHAR(20)   NOT NULL,
        purpose                     TEXT          NOT NULL,
        amountRequested             DOUBLE        NOT NULL,
        status                      ENUM('PENDING','APPROVED','REJECTED','REALIZED','COMPLETED') NOT NULL DEFAULT 'PENDING',
        approvedBy                  VARCHAR(255)  NULL,
        approvedAt                  VARCHAR(30)   NULL,
        rejectionReason             TEXT          NULL,
        debitAccountId              VARCHAR(36)   NULL,
        creditAccountId             VARCHAR(36)   NULL,
        journalEntryId              VARCHAR(36)   NULL,
        realizationId               VARCHAR(36)   NULL,
        realizationDate             VARCHAR(20)   NULL,
        realizationActualAmount     DOUBLE        NULL,
        realizationExpenseLines     TEXT          NULL,
        realizationRefundAccountId  VARCHAR(36)   NULL,
        realizationNotes            TEXT          NULL,
        realizationJournalId        VARCHAR(36)   NULL,
        createdAt                   DATETIME      NOT NULL DEFAULT NOW(),
        updatedAt                   DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // users: tambah linkedAccountId jika belum ada
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedAccountId VARCHAR(36) NULL`).catch(() => {
      return conn.query(`ALTER TABLE users ADD COLUMN linkedAccountId VARCHAR(36) NULL`).catch(() => {});
    });

    // users: update role ENUM agar mencakup KARYAWAN
    await conn.query(`
      ALTER TABLE users MODIFY COLUMN role ENUM('SUPERADMIN','ADMIN','SUPERVISOR','ACCOUNTANT','VIEWER','KARYAWAN') NOT NULL DEFAULT 'ACCOUNTANT'
    `).catch(() => {});

    // app_config: tambah onboardingCompleted (DEFAULT 1 = existing companies sudah done)
    await conn.query(
      `ALTER TABLE app_config ADD COLUMN IF NOT EXISTS onboardingCompleted TINYINT(1) NOT NULL DEFAULT 1`
    ).catch(() =>
      conn.query(`ALTER TABLE app_config ADD COLUMN onboardingCompleted TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {})
    );

    // companies: tambah kolom code (Company ID unik, e.g. MAJU-K3P2)
    await conn.query(
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS code VARCHAR(20) NULL`
    ).catch(() =>
      conn.query(`ALTER TABLE companies ADD COLUMN code VARCHAR(20) NULL`).catch(() => {})
    );
    // Set code default untuk company id=1 HANYA jika belum ada (jangan overwrite)
    await conn.query(`UPDATE companies SET code = 'STAI-ASTA' WHERE id = 1 AND (code IS NULL OR code = '' OR code = 'ACCS-0001')`).catch(() => {});
    // Isi code untuk companies lain yang belum punya
    await conn.query(`
      UPDATE companies SET code = CONCAT('ACCS-', LPAD(id, 4, '0'))
      WHERE code IS NULL OR code = ''
    `).catch(() => {});
    // Buat unique constraint untuk code (jika belum ada)
    await conn.query(
      `ALTER TABLE companies ADD UNIQUE INDEX uniq_company_code (code)`
    ).catch(() => {});
    // Ubah code menjadi NOT NULL setelah semua data terisi
    await conn.query(
      `ALTER TABLE companies MODIFY COLUMN code VARCHAR(20) NOT NULL`
    ).catch(() => {});

    // ── BILLING: addon_modules table ─────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS addon_modules (
        id           INT           PRIMARY KEY AUTO_INCREMENT,
        name         VARCHAR(255)  NOT NULL,
        slug         VARCHAR(100)  NOT NULL UNIQUE,
        description  TEXT          NULL,
        priceMonthly INT           NOT NULL DEFAULT 0,
        isActive     TINYINT(1)    NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Seed default add-on modules
    await conn.query(`
      INSERT IGNORE INTO addon_modules (id, name, slug, description, priceMonthly) VALUES
      (1, 'Manajemen Dana', 'manajemen-dana', 'Kelola pengajuan dan realisasi dana karyawan', 49000),
      (2, 'Repository Dokumen', 'repository-dokumen', 'Simpan dan kelola dokumen keuangan & audit', 39000)
    `);

    // ── BILLING: subscriptions table ─────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id              INT           PRIMARY KEY AUTO_INCREMENT,
        companyId       INT           NOT NULL,
        billingCycle    ENUM('monthly','yearly') NOT NULL,
        status          ENUM('active','expired','pending') NOT NULL DEFAULT 'pending',
        startDate       DATE          NULL,
        endDate         DATE          NULL,
        reminderSentAt  DATE          NULL,
        createdAt       DATETIME      NOT NULL DEFAULT NOW(),
        updatedAt       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── BILLING: company_addons table ────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_addons (
        id         INT  PRIMARY KEY AUTO_INCREMENT,
        companyId  INT  NOT NULL,
        moduleId   INT  NOT NULL,
        status     ENUM('active','expired') NOT NULL DEFAULT 'active',
        startDate  DATE NULL,
        endDate    DATE NULL,
        UNIQUE KEY uniq_company_module (companyId, moduleId),
        FOREIGN KEY (moduleId) REFERENCES addon_modules(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── BILLING: invoices table ──────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id              VARCHAR(36)   PRIMARY KEY,
        companyId       INT           NOT NULL,
        \`type\`        ENUM('subscription','addon') NOT NULL,
        description     VARCHAR(500)  NOT NULL,
        amount          INT           NOT NULL,
        status          ENUM('pending','paid','failed','expired') NOT NULL DEFAULT 'pending',
        billingCycle    ENUM('monthly','yearly') NULL,
        addonModuleId   INT           NULL,
        gatewayOrderId  VARCHAR(100)  NULL,
        snapToken       TEXT          NULL,
        paidAt          DATETIME      NULL,
        expiredAt       DATETIME      NULL,
        createdAt       DATETIME      NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── BILLING: tambah kolom planTier ke subscriptions ─────────────────────
    await conn.query(
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS planTier ENUM('starter','professional') NOT NULL DEFAULT 'starter'`
    ).catch(() =>
      conn.query(`ALTER TABLE subscriptions ADD COLUMN planTier ENUM('starter','professional') NOT NULL DEFAULT 'starter'`).catch(() => {})
    );

    // ── BILLING: tambah status 'trial' ke ENUM subscriptions ─────────────────
    await conn.query(
      `ALTER TABLE subscriptions MODIFY COLUMN status ENUM('active','expired','pending','trial') NOT NULL DEFAULT 'pending'`
    ).catch(() => {});

    // ── BILLING: grace period 6 bulan untuk company lama (belum punya subscription) ─
    await conn.query(`
      INSERT INTO subscriptions (companyId, planTier, billingCycle, status, startDate, endDate)
      SELECT c.id, 'starter', 'monthly', 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
      FROM companies c
      LEFT JOIN subscriptions s ON s.companyId = c.id
      WHERE s.id IS NULL
    `).catch(e => console.warn('[Migration] Grace period skip:', (e as any).message));

    console.log('✅ Migrations applied');
  } finally {
    conn.release();
  }
}

app.listen(PORT, async () => {
  try {
    // Test koneksi database menggunakan mysql2 pool langsung
    const conn = await pool.getConnection();
    conn.release();
    console.log(`✅ Database connected`);
    await runMigrations();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log(`🚀 AccessTansi API running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
