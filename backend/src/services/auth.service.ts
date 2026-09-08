import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, users, companies, companyProfile, appConfig, pool } from '../lib/prisma';
import { eq, and } from 'drizzle-orm';
import { emailService } from './email.service';

// ─── Generate Company ID unik ─────────────────────────────────────────────────
// Format: XXXX-YYYY  (4 huruf dari nama + dash + 4 karakter random alphanumeric)
// Contoh: MAJU-K3P2, BUDI-XYWZ, ASTA-7KLM
function generateCompanyCode(companyName: string): string {
  // Ambil huruf pertama dari kata-kata (skip kata umum)
  const SKIP = new Set(['PT', 'CV', 'UD', 'PD', 'THE', 'AND', 'KOPERASI', 'YAYASAN', 'FIRMA']);
  const words = companyName.toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/);
  const significant = words.filter(w => !SKIP.has(w));

  let prefix = '';
  if (significant.length >= 4) {
    // 4 kata atau lebih → ambil 1 huruf dari 4 kata pertama: STAI → S T A I
    prefix = significant.slice(0, 4).map(w => w[0]).join('');
  } else if (significant.length === 3) {
    // 3 kata → 2+1+1 atau distribusi rata
    prefix = (significant[0].substring(0, 2) + significant[1][0] + significant[2][0]).substring(0, 4);
  } else if (significant.length === 2) {
    // 2 kata → 2+2
    prefix = (significant[0].substring(0, 2) + significant[1].substring(0, 2)).substring(0, 4);
  } else {
    // 1 kata → 4 huruf pertama
    prefix = (significant[0] || 'ACCS').substring(0, 4).padEnd(4, 'X');
  }
  prefix = prefix.padEnd(4, 'X').substring(0, 4);

  // 4 karakter random (tanpa huruf ambigu O, I, L, 0, 1)
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  return `${prefix}-${suffix}`;
}

// Coba generate kode unik (maksimal 10 percobaan jika collision)
async function uniqueCompanyCode(companyName: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCompanyCode(companyName);
    const [existing] = await db.select({ id: companies.id })
      .from(companies).where(eq(companies.code, code)).limit(1);
    if (!existing) return code;
  }
  // Fallback: prefix + timestamp 4 digit
  const prefix = companyName.replace(/[^A-Za-z]/g, '').toUpperCase().substring(0, 4).padEnd(4, 'X');
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {

  async login(companyCode: string, email: string, password: string) {
    const MAX_ATTEMPTS = 5;
    const LOCK_MINUTES = 30;

    // 1. Cari company berdasarkan code
    const [company] = await db.select({ id: companies.id, isActive: companies.isActive })
      .from(companies)
      .where(eq(companies.code, companyCode.trim().toUpperCase()))
      .limit(1);

    if (!company || !company.isActive) {
      throw new Error('Company ID tidak ditemukan atau tidak aktif');
    }

    // 2. Cari user berdasarkan email DAN companyId
    const [user] = await db.select().from(users)
      .where(and(eq(users.email, email), eq(users.companyId, company.id)))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('Email atau password salah');
    }

    // 3. Cek apakah akun sedang terkunci
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const menitSisa = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      throw new Error(`Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${menitSisa} menit.`);
    }

    // 4. Verifikasi password
    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      // Tambah counter gagal
      const newAttempts = (user.loginAttempts ?? 0) + 1;
      const shouldLock  = newAttempts >= MAX_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;

      await db.update(users)
        .set({ loginAttempts: newAttempts, lockedUntil })
        .where(eq(users.id, user.id));

      if (shouldLock) {
        throw new Error(`Akun dikunci selama ${LOCK_MINUTES} menit karena terlalu banyak percobaan gagal.`);
      }

      const sisaPercobaan = MAX_ATTEMPTS - newAttempts;
      throw new Error(`Email atau password salah. Sisa percobaan: ${sisaPercobaan}.`);
    }

    // 5. Login sukses — reset counter
    await db.update(users)
      .set({ loginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '7d',
    });

    const { passwordHash: _, loginAttempts: __, lockedUntil: ___, ...safeUser } = user;
    return { token, user: safeUser };
  },

  async register(data: {
    companyName: string;
    ownerEmail: string;
    ownerName: string;
    password: string;
  }) {
    const { companyName, ownerEmail, ownerName, password } = data;

    // Cek email sudah terdaftar
    const [existingUser] = await db.select({ id: users.id })
      .from(users).where(eq(users.email, ownerEmail)).limit(1);
    if (existingUser) throw new Error('Email sudah terdaftar');

    // Generate slug unik
    const baseSlug = companyName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${baseSlug.substring(0, 80)}-${Date.now()}`;

    // Generate Company ID unik
    const code = await uniqueCompanyCode(companyName);

    // Buat perusahaan baru
    const companyResult = await db.insert(companies).values({
      name: companyName,
      slug,
      code,
      ownerEmail,
      plan: 'FREE',
      isActive: true,
    });
    // Drizzle v0.30 + mysql2 pool → result bisa berupa [OkPacket, ...] atau langsung OkPacket
    const raw = companyResult as any;
    const companyId = Number(raw.insertId ?? raw[0]?.insertId ?? 0);
    if (!companyId) throw new Error('Gagal membuat perusahaan: insertId tidak tersedia');

    // Buat user owner (role SUPERADMIN, semua permission)
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      companyId,
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      role: 'SUPERADMIN',
      isActive: true,
      canManageUsers: true,
      canManageSettings: true,
      canManageCOA: true,
      canEntryJournal: true,
      canApproveJournal: true,
      canDeleteJournal: true,
      canViewReports: true,
      canManageInventory: true,
      canManagePurchasing: true,
      canManageSales: true,
      canOperatePOS: true,
      canVoidPOSTransaction: true,
    });

    // Buat company_profile singleton (id = companyId)
    await db.insert(companyProfile).values({
      id: companyId,
      name: companyName,
      address: '',
      city: '',
      phone: '',
      email: ownerEmail,
    }).onDuplicateKeyUpdate({ set: { name: companyName } });

    // Buat app_config singleton (id = companyId)
    // onboardingCompleted: false → wizard ditampilkan saat pertama login
    await db.insert(appConfig).values({
      id: companyId,
      lockDate: '',
      fiscalYearStartMonth: 1,
      activePeriod: new Date().getFullYear().toString(),
      onboardingCompleted: false,
    }).onDuplicateKeyUpdate({ set: { lockDate: '' } });

    // Buat trial subscription 7 hari
    const trialConn = await pool.getConnection();
    try {
      await trialConn.query(
        `INSERT INTO subscriptions (companyId, planTier, billingCycle, status, startDate, endDate)
         VALUES (?, 'starter', 'monthly', 'trial', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY))`,
        [companyId]
      );
    } finally {
      trialConn.release();
    }

    // Kirim welcome email (async, tidak blokir response)
    emailService.sendWelcomeEmail({
      companyName,
      companyCode: code,
      ownerName,
      ownerEmail,
      password, // plain text — user baru saja set ini
    }).catch(() => { /* sudah di-log di dalam service */ });

    return {
      companyId,
      companyCode: code,
      message: 'Registrasi berhasil. Simpan Company ID Anda untuk login.',
    };
  },

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  },
};
