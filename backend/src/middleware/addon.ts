import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/prisma';

/**
 * Blokir akses route jika company belum mengaktifkan add-on module tertentu.
 * Beda dari subscriptionGuard (langganan dasar) — ini per-modul, dipakai untuk
 * fitur add-on seperti Persediaan & Dagang. Pakai status 403 (bukan 402) supaya
 * tidak memicu banner "langganan expired" global di frontend.
 */
export const requireAddon = (slug: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(401).json({ error: 'Token tidak ditemukan' }); return; }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT ca.status FROM company_addons ca
         JOIN addon_modules am ON ca.moduleId = am.id
         WHERE ca.companyId = ? AND am.slug = ?
         ORDER BY ca.id DESC LIMIT 1`,
        [companyId, slug]
      ) as any;
      const addon = (rows as any[])[0];

      if (!addon || addon.status !== 'active') {
        res.status(403).json({
          error: 'Add-on modul ini belum aktif. Silakan aktifkan lewat halaman Billing.',
          code: 'ADDON_NOT_ACTIVE',
          slug,
        });
        return;
      }
      next();
    } finally {
      conn.release();
    }
  };
};
