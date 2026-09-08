import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/prisma';

// Routes yang tidak perlu cek subscription
const EXEMPT = ['/api/auth', '/api/billing', '/health'];

export const subscriptionGuard = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  // Skip exempt routes
  if (EXEMPT.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }

  // Tidak ada token → biarkan authenticate() yang reject
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  let companyId: number;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { companyId: number };
    companyId = payload.companyId;
  } catch {
    return next(); // token invalid → authenticate() yang handle
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT status, endDate FROM subscriptions WHERE companyId = ? ORDER BY id DESC LIMIT 1`,
      [companyId]
    ) as any;
    const sub = (rows as any[])[0];

    if (!sub) {
      res.status(402).json({
        error: 'Tidak ada langganan aktif. Silakan pilih paket di halaman Billing.',
        code: 'NO_SUBSCRIPTION',
      });
      return;
    }

    const isExpired = new Date(sub.endDate) < new Date();
    if (isExpired || sub.status === 'expired') {
      const isTrial = sub.status === 'trial';
      res.status(402).json({
        error: isTrial
          ? 'Masa trial telah berakhir. Silakan upgrade untuk melanjutkan.'
          : 'Langganan telah berakhir. Silakan perpanjang untuk melanjutkan.',
        code: 'SUBSCRIPTION_EXPIRED',
        isTrial,
      });
      return;
    }
  } finally {
    conn.release();
  }

  next();
};
