import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { subscriptionGuard } from './middleware/subscription';
import { authRouter } from './routes/auth.routes';
import { accountsRouter } from './routes/accounts.routes';
import { contactsRouter } from './routes/contacts.routes';
import { journalsRouter } from './routes/journals.routes';
import { budgetsRouter } from './routes/budgets.routes';
import { usersRouter } from './routes/users.routes';
import { settingsRouter } from './routes/settings.routes';
import { periodsRouter } from './routes/periods.routes';
import { aiRouter } from './routes/ai.routes';
import { auditDocsRouter } from './routes/auditDocs.routes';
import { docGroupsRouter } from './routes/docGroups.routes';
import { docCategoriesRouter } from './routes/docCategories.routes';
import { bankStatementsRouter } from './routes/bankStatements.routes';
import { fundRequestsRouter } from './routes/fundRequests.routes';
import { productCategoriesRouter } from './routes/productCategories.routes';
import { unitsRouter } from './routes/units.routes';
import { warehousesRouter } from './routes/warehouses.routes';
import { productsRouter } from './routes/products.routes';
import { inventorySettingsRouter } from './routes/inventorySettings.routes';
import { stockAdjustmentsRouter } from './routes/stockAdjustments.routes';
import { inventoryRouter } from './routes/inventory.routes';
import { purchaseOrdersRouter } from './routes/purchaseOrders.routes';
import { goodsReceiptsRouter } from './routes/goodsReceipts.routes';
import { purchasePaymentsRouter } from './routes/purchasePayments.routes';
import { salesInvoicesRouter } from './routes/salesInvoices.routes';
import { salesPaymentsRouter } from './routes/salesPayments.routes';
import { posShiftsRouter } from './routes/posShifts.routes';
import { posRouter } from './routes/pos.routes';
import billingRouter from './routes/billing.routes';
import { errorHandler } from './middleware/errorHandler';
import path from 'path';

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Rumah Web pakai reverse proxy (LiteSpeed) — skip validasi X-Forwarded-For
const rateLimitBase = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
};

/** Login: maks 10 percobaan per 15 menit per IP */
const loginLimiter = rateLimit({
  ...rateLimitBase,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

/** Register: maks 5 registrasi per jam per IP */
const registerLimiter = rateLimit({
  ...rateLimitBase,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak permintaan registrasi. Coba lagi dalam 1 jam.' },
});

/** Global API: maks 200 request per menit per IP */
const globalLimiter = rateLimit({
  ...rateLimitBase,
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Terlalu banyak request. Coba lagi sebentar.' },
});

export const createApp = () => {
  const app = express();

  // Trust reverse proxy (LiteSpeed/Nginx di Rumah Web / Railway)
  // Wajib agar express-rate-limit bisa baca IP asli dari X-Forwarded-For
  app.set('trust proxy', 1);

  const allowedOrigins = [
    'https://app.accesstansi.id',          // production frontend (React app)
    'https://www.app.accesstansi.id',
    'https://accesstansi.id',              // landing page (daftar.html)
    'https://www.accesstansi.id',
    process.env.FRONTEND_URL,              // env override jika ada
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean) as string[];

  // CORS harus paling pertama — supaya header selalu ada meski rate limiter/helmet ngerespons duluan
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }));

  // Security headers — CSP, X-Frame-Options, HSTS, dll
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // izinkan /uploads diakses frontend
  }));

  // Global rate limit
  app.use('/api', globalLimiter);

  // DOKU webhook needs raw body for HMAC-SHA256 signature verification
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Subscription guard — blokir akses jika trial/langganan expired
  app.use(subscriptionGuard);

  // API Routes — auth dengan rate limiter spesifik
  app.use('/api/auth/login',    loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/journals', journalsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/periods', periodsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/audit-docs', auditDocsRouter);
  app.use('/api/doc-groups', docGroupsRouter);
  app.use('/api/doc-categories', docCategoriesRouter);
  app.use('/api/fund-requests', fundRequestsRouter);
  app.use('/api/bank-statements', bankStatementsRouter);
  app.use('/api/product-categories', productCategoriesRouter);
  app.use('/api/units', unitsRouter);
  app.use('/api/warehouses', warehousesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/inventory-settings', inventorySettingsRouter);
  app.use('/api/stock-adjustments', stockAdjustmentsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/purchase-orders', purchaseOrdersRouter);
  app.use('/api/goods-receipts', goodsReceiptsRouter);
  app.use('/api/purchase-payments', purchasePaymentsRouter);
  app.use('/api/sales-invoices', salesInvoicesRouter);
  app.use('/api/sales-payments', salesPaymentsRouter);
  app.use('/api/pos/shifts', posShiftsRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/billing', billingRouter);

  // Serve uploaded files as static — accessible via /uploads/audit-docs/filename
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  app.use(errorHandler);

  return app;
};
