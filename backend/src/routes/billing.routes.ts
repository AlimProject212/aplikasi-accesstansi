import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../lib/prisma';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';

const router = Router();

// ─── URL config ───────────────────────────────────────────────────────────────
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://app.accesstansi.id').trim();
const BACKEND_URL  = (process.env.BACKEND_URL  || 'https://api.accesstansi.id').trim();

// ─── DOKU config ──────────────────────────────────────────────────────────────
const DOKU_CLIENT_ID  = (process.env.DOKU_CLIENT_ID  || '').trim();
const DOKU_SECRET_KEY = (process.env.DOKU_SECRET_KEY || '').trim();
const DOKU_API_KEY    = (process.env.DOKU_API_KEY    || '').trim();
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'sandbox'
  ? 'https://api-sandbox.doku.com'
  : 'https://api.doku.com';
const DOKU_CHECKOUT_PATH  = '/checkout/v1/payment';
const DOKU_WEBHOOK_PATH   = '/api/billing/webhook';

// Signature per DOKU official docs:
// - Request-Target = path only (no HTTP method prefix)
// - Digest = plain base64 of SHA-256 body (no "SHA-256=" prefix)
// - Return prefix = "HMACSHA256=" (no space)
function buildSignature(hmacKey: string, requestId: string, timestamp: string, body: string, requestTarget: string): string {
  const digest    = crypto.createHash('sha256').update(body, 'utf-8').digest('base64');
  const component = `Client-Id:${DOKU_CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
  return 'HMACSHA256=' + crypto.createHmac('sha256', hmacKey).update(component).digest('base64');
}

function dokuRequestSignature(requestId: string, timestamp: string, body: string): string {
  return buildSignature(DOKU_SECRET_KEY, requestId, timestamp, body, DOKU_CHECKOUT_PATH);
}

function dokuWebhookSignature(clientId: string, requestId: string, timestamp: string, rawBody: string): string {
  const digest    = crypto.createHash('sha256').update(rawBody, 'utf-8').digest('base64');
  const component = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${DOKU_WEBHOOK_PATH}\nDigest:${digest}`;
  return 'HMACSHA256=' + crypto.createHmac('sha256', DOKU_SECRET_KEY).update(component).digest('base64');
}

// ─── Plan prices (IDR) ────────────────────────────────────────────────────────
const PRICES = {
  starter:      { monthly: Number(process.env.STARTER_PRICE_MONTHLY) || 79000,  yearly: Number(process.env.STARTER_PRICE_YEARLY)  || 790000  },
  professional: { monthly: Number(process.env.PRO_PRICE_MONTHLY)     || 149000, yearly: Number(process.env.PRO_PRICE_YEARLY)      || 1490000 },
};

// ─── Helper: send reminder email ─────────────────────────────────────────────
async function sendReminderEmail(
  email: string, companyName: string, daysLeft: number, endDate: Date, isTrial = false
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const dateStr  = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const subject  = isTrial
    ? `Trial AccessTansi ${companyName} berakhir ${daysLeft} hari lagi — Upgrade sekarang`
    : `Langganan AccessTansi ${companyName} akan berakhir ${daysLeft} hari lagi`;
  const headline = isTrial ? 'Masa Trial Hampir Berakhir' : 'Masa Aktif Hampir Berakhir';
  const body     = isTrial
    ? `Trial gratis AccessTansi untuk <strong>${companyName}</strong> akan berakhir pada <strong>${dateStr}</strong> (${daysLeft} hari lagi). Upgrade sekarang untuk tetap bisa mengakses semua fitur.`
    : `Langganan AccessTansi untuk <strong>${companyName}</strong> akan berakhir pada <strong>${dateStr}</strong> (${daysLeft} hari lagi). Perpanjang agar tidak terganggu aksesnya.`;
  const btnText  = isTrial ? 'Upgrade Sekarang' : 'Perpanjang Sekarang';
  const billingUrl = FRONTEND_URL;

  await transporter.sendMail({
    from:    `"AccessTansi" <${process.env.SMTP_USER}>`,
    to:      email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#1a1a2e;padding:20px;border-radius:8px;text-align:center;margin-bottom:20px">
          <h1 style="color:#d4a843;margin:0">AccessTansi</h1>
          <p style="color:#aaa;margin:5px 0 0">Software Akuntansi Profesional</p>
        </div>
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:20px;margin-bottom:20px">
          <h2 style="color:#856404;margin:0 0 10px">⚠️ ${headline}</h2>
          <p style="color:#856404;margin:0">${body}</p>
        </div>
        <div style="text-align:center;margin:30px 0">
          <a href="${billingUrl}"
             style="background:#d4a843;color:#000;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">
            ${btnText}
          </a>
        </div>
        <p style="color:#666;font-size:12px;text-align:center">Email ini dikirim otomatis oleh AccessTansi.</p>
      </div>
    `,
  });
}

// ─── GET /api/billing/status ──────────────────────────────────────────────────
router.get('/status', authenticate, async (req: Request, res: Response) => {
  const companyId = (req as any).user?.companyId || 1;
  const conn = await pool.getConnection();
  try {
    const [subRows] = await conn.query(
      `SELECT * FROM subscriptions WHERE companyId = ? ORDER BY id DESC LIMIT 1`,
      [companyId]
    ) as any;
    const sub = (subRows as any[])[0] || null;

    const [addonRows] = await conn.query(
      `SELECT ca.*, am.name, am.slug, am.description, am.priceMonthly
       FROM company_addons ca
       JOIN addon_modules am ON ca.moduleId = am.id
       WHERE ca.companyId = ?`,
      [companyId]
    ) as any;

    const [moduleRows] = await conn.query(
      `SELECT * FROM addon_modules WHERE isActive = 1`
    ) as any;

    let daysLeft = 0;
    let isExpired = false;
    const isTrial = sub?.status === 'trial';

    if (sub?.endDate) {
      const now = new Date();
      const end = new Date(sub.endDate);
      daysLeft  = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      isExpired = daysLeft <= 0;

      const reminderThreshold = isTrial ? 3 : 5;
      if (daysLeft > 0 && daysLeft <= reminderThreshold && (sub.status === 'active' || sub.status === 'trial')) {
        const today           = new Date().toISOString().split('T')[0];
        const lastReminderDay = sub.reminderSentAt
          ? new Date(sub.reminderSentAt).toISOString().split('T')[0] : null;
        if (lastReminderDay !== today) {
          const [compRows] = await conn.query(
            `SELECT c.ownerEmail, COALESCE(cp.name, c.name) AS companyName
             FROM companies c LEFT JOIN company_profile cp ON c.id = cp.id
             WHERE c.id = ?`, [companyId]
          ) as any;
          const comp = (compRows as any[])[0];
          if (comp?.ownerEmail) {
            sendReminderEmail(comp.ownerEmail, comp.companyName, daysLeft, end, isTrial)
              .catch(e => console.error('Email reminder error:', e));
            await conn.query(
              `UPDATE subscriptions SET reminderSentAt = CURDATE() WHERE id = ?`, [sub.id]
            );
          }
        }
      }
    }

    res.json({
      subscription: sub ? {
        id:           sub.id,
        planTier:     sub.planTier || 'starter',
        billingCycle: sub.billingCycle,
        status:       isExpired ? 'expired' : sub.status,
        startDate:    sub.startDate,
        endDate:      sub.endDate,
        daysLeft:     Math.max(0, daysLeft),
        isExpired,
        isTrial,
      } : null,
      prices: PRICES,
      addons: (addonRows as any[]).map((a: any) => ({
        id: a.id, moduleId: a.moduleId, name: a.name, slug: a.slug,
        description: a.description, priceMonthly: a.priceMonthly,
        status: a.status, endDate: a.endDate,
      })),
      availableModules: (moduleRows as any[]).map((m: any) => ({
        id: m.id, name: m.name, slug: m.slug,
        description: m.description, priceMonthly: m.priceMonthly,
      })),
    });
  } finally {
    conn.release();
  }
});


// ─── POST /api/billing/checkout ───────────────────────────────────────────────
router.post('/checkout', authenticate, async (req: Request, res: Response) => {
  const companyId = (req as any).user?.companyId || 1;
  const { type, planTier, billingCycle, addonModuleId } = req.body;

  const conn = await pool.getConnection();
  try {
    const [compRows] = await conn.query(
      `SELECT c.ownerEmail, COALESCE(cp.name, c.name) AS displayName
       FROM companies c LEFT JOIN company_profile cp ON c.id = cp.id WHERE c.id = ?`,
      [companyId]
    ) as any;
    const comp = (compRows as any[])[0];

    let amount = 0;
    let description = '';
    let moduleInfo: any = null;

    if (type === 'subscription') {
      const tier = (planTier === 'professional') ? 'professional' : 'starter';
      const p    = PRICES[tier];
      amount      = billingCycle === 'yearly' ? p.yearly : p.monthly;
      const tierLabel  = tier === 'professional' ? 'Professional' : 'Starter';
      const cycleLabel = billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan';
      description = `Langganan AccessTansi ${tierLabel} ${cycleLabel}`;
    } else if (type === 'addon' && addonModuleId) {
      // Add-on hanya boleh dibeli oleh company dengan paket Professional aktif —
      // dicek di sini (bukan cuma disembunyikan di UI) supaya gak bisa dilewati
      // dengan manggil endpoint ini langsung.
      const [subRows] = await conn.query(
        `SELECT * FROM subscriptions WHERE companyId = ? ORDER BY id DESC LIMIT 1`, [companyId]
      ) as any;
      const sub = (subRows as any[])[0];
      const isExpired = sub?.endDate ? new Date(sub.endDate).getTime() <= Date.now() : true;
      if (!sub || sub.planTier !== 'professional' || isExpired) {
        res.status(403).json({ error: 'Add-on hanya tersedia untuk paket Professional. Upgrade dulu sebelum membeli add-on.' });
        return;
      }

      const [modRows] = await conn.query(
        `SELECT * FROM addon_modules WHERE id = ? AND isActive = 1`, [addonModuleId]
      ) as any;
      moduleInfo = (modRows as any[])[0];
      if (!moduleInfo) { res.status(404).json({ error: 'Modul tidak ditemukan' }); return; }
      amount      = moduleInfo.priceMonthly;
      description = `Add-on ${moduleInfo.name} - 1 Bulan`;
    } else {
      res.status(400).json({ error: 'Parameter tidak valid' }); return;
    }

    const invoiceId = randomUUID();
    const orderId   = `AT-${invoiceId.substring(0, 8).toUpperCase()}`;
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Subscription menyimpan metadata sebagai JSON agar webhook bisa ekstrak planTier
    const invoiceDescription = type === 'subscription'
      ? JSON.stringify({ label: description, planTier: planTier || 'starter', billingCycle })
      : description;

    await conn.query(
      `INSERT INTO invoices (id, companyId, type, description, amount, status, billingCycle, addonModuleId, gatewayOrderId, expiredAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [invoiceId, companyId, type, invoiceDescription, amount, billingCycle || null, addonModuleId || null, orderId, expiredAt]
    );

    // ── Call DOKU Checkout API ──────────────────────────────────────────────
    const frontendUrl = FRONTEND_URL;
    const backendUrl  = BACKEND_URL;

    const dokuPayload = {
      order: {
        invoice_number: orderId,
        line_items: [{
          name:     description.substring(0, 255),
          price:    amount,
          quantity: 1,
          sku:      type === 'subscription' ? `sub-${planTier || 'starter'}` : `addon-${addonModuleId}`,
        }],
        amount,
        currency:     'IDR',
        session_id:   invoiceId,
        callback_url: `${backendUrl}/api/billing/webhook`,
        success_url:  `${frontendUrl}/billing?payment=success&ref=${orderId}`,
        failed_url:   `${frontendUrl}/billing?payment=failed&ref=${orderId}`,
        expiry_time:  1440,
        language:     'ID',
      },
      payment: { payment_due_date: 1440 },
      customer: {
        name:  comp?.displayName || 'User',
        email: comp?.ownerEmail  || '',
      },
    };

    const requestId = randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const bodyStr   = JSON.stringify(dokuPayload);
    const signature = dokuRequestSignature(requestId, timestamp, bodyStr);

    const dokuRes  = await fetch(`${DOKU_BASE_URL}${DOKU_CHECKOUT_PATH}`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'Client-Id':         DOKU_CLIENT_ID,
        'Request-Id':        requestId,
        'Request-Timestamp': timestamp,
        'Signature':         signature,
      },
      body: bodyStr,
    });

    const dokuData = await dokuRes.json() as any;
    // DOKU response: { message: [...], response: { payment: { url: '...' } } }
    const paymentUrl = dokuData?.response?.payment?.url;

    if (!dokuRes.ok || !paymentUrl) {
      const dokuMsg = dokuData?.error?.message || dokuData?.response?.message || dokuData?.message || JSON.stringify(dokuData);
      console.error('DOKU error:', JSON.stringify(dokuData));
      await conn.query(`UPDATE invoices SET status = 'failed' WHERE id = ?`, [invoiceId]);
      res.status(502).json({ error: 'Gagal membuat transaksi pembayaran', detail: dokuMsg });
      return;
    }

    // Store payment URL in snapToken column (repurposed)
    await conn.query(`UPDATE invoices SET snapToken = ? WHERE id = ?`, [paymentUrl, invoiceId]);

    res.json({ invoiceId, paymentUrl, amount, description });
  } finally {
    conn.release();
  }
});

// ─── GET /api/billing/webhook ─────────────────────────────────────────────────
// DOKU menggunakan callback_url sebagai tombol "Kembali ke Merchant" (GET redirect dari browser).
// Redirect ke halaman billing frontend agar user tidak mendarat di API endpoint.
router.get('/webhook', (_req: Request, res: Response) => {
  res.redirect(`${FRONTEND_URL}/billing`);
});

// ─── POST /api/billing/webhook ────────────────────────────────────────────────
// Note: express.raw() is applied to this route in app.ts so req.body is a Buffer
router.post('/webhook', async (req: Request, res: Response) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : JSON.stringify(req.body);

  const notification = (() => {
    try { return JSON.parse(rawBody); } catch { return {}; }
  })();

  // ── Verify DOKU signature ─────────────────────────────────────────────────
  const clientId  = req.headers['client-id']         as string;
  const requestId = req.headers['request-id']        as string;
  const timestamp = req.headers['request-timestamp'] as string;
  const incoming  = req.headers['signature']         as string;

  if (clientId !== DOKU_CLIENT_ID) {
    res.status(403).json({ error: 'Invalid client' }); return;
  }

  const expected = dokuWebhookSignature(clientId, requestId, timestamp, rawBody);
  if (incoming !== expected) {
    console.warn('DOKU webhook signature mismatch', { incoming, expected });
    res.status(403).json({ error: 'Invalid signature' }); return;
  }

  // ── Process notification ──────────────────────────────────────────────────
  const invoiceNumber = notification.order?.invoice_number as string;
  const txStatus      = notification.transaction?.status   as string; // SUCCESS | FAILED | EXPIRED

  const isSuccess = txStatus === 'SUCCESS';
  const isFailed  = txStatus === 'FAILED' || txStatus === 'EXPIRED';

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT * FROM invoices WHERE gatewayOrderId = ?`, [invoiceNumber]
    ) as any;
    const invoice = (rows as any[])[0];
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    if (isSuccess && invoice.status !== 'paid') {
      await conn.query(
        `UPDATE invoices SET status = 'paid', paidAt = NOW() WHERE gatewayOrderId = ?`,
        [invoiceNumber]
      );

      const now = new Date();
      if (invoice.type === 'subscription') {
        let planTier = 'starter';
        try { planTier = JSON.parse(invoice.description)?.planTier || 'starter'; } catch {}

        const [subRows] = await conn.query(
          `SELECT * FROM subscriptions WHERE companyId = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
          [invoice.companyId]
        ) as any;
        const existing = (subRows as any[])[0];
        const baseDate = (existing && new Date(existing.endDate) > now) ? new Date(existing.endDate) : now;
        const endDate  = new Date(baseDate);
        if (invoice.billingCycle === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
        else endDate.setMonth(endDate.getMonth() + 1);

        if (existing) {
          await conn.query(
            `UPDATE subscriptions SET status='active', planTier=?, billingCycle=?, startDate=?, endDate=?, updatedAt=NOW() WHERE id=?`,
            [planTier, invoice.billingCycle, now, endDate, existing.id]
          );
        } else {
          await conn.query(
            `INSERT INTO subscriptions (companyId, planTier, billingCycle, status, startDate, endDate)
             VALUES (?, ?, ?, 'active', ?, ?)`,
            [invoice.companyId, planTier, invoice.billingCycle, now, endDate]
          );
        }
      } else if (invoice.type === 'addon' && invoice.addonModuleId) {
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        await conn.query(
          `INSERT INTO company_addons (companyId, moduleId, status, startDate, endDate)
           VALUES (?, ?, 'active', ?, ?)
           ON DUPLICATE KEY UPDATE status='active', startDate=VALUES(startDate), endDate=VALUES(endDate)`,
          [invoice.companyId, invoice.addonModuleId, now, endDate]
        );
      }
    } else if (isFailed) {
      await conn.query(
        `UPDATE invoices SET status=? WHERE gatewayOrderId=?`,
        [txStatus === 'EXPIRED' ? 'expired' : 'failed', invoiceNumber]
      );
    }

    res.json({ status: 'OK' });
  } finally {
    conn.release();
  }
});

// ─── GET /api/billing/invoices ────────────────────────────────────────────────
router.get('/invoices', authenticate, async (req: Request, res: Response) => {
  const companyId = (req as any).user?.companyId || 1;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT * FROM invoices WHERE companyId = ? ORDER BY createdAt DESC LIMIT 20`,
      [companyId]
    ) as any;
    const cleaned = (rows as any[]).map((r: any) => {
      try {
        const parsed = JSON.parse(r.description);
        return { ...r, description: parsed.label || r.description };
      } catch { return r; }
    });
    res.json(cleaned);
  } finally {
    conn.release();
  }
});

// ─── GET /api/billing/modules ─────────────────────────────────────────────────
router.get('/modules', authenticate, async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM addon_modules WHERE isActive = 1`) as any;
    res.json(rows);
  } finally {
    conn.release();
  }
});

export default router;
