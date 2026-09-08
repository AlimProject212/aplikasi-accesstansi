import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';

export const authRouter = Router();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  companyCode: z.string().min(1, 'Company ID wajib diisi').max(20).trim(),
  email:       z.string().email('Format email tidak valid').max(255).trim().toLowerCase(),
  password:    z.string().min(1, 'Password wajib diisi').max(128),
});

const registerSchema = z.object({
  companyName: z.string()
    .min(2, 'Nama perusahaan minimal 2 karakter')
    .max(100, 'Nama perusahaan maksimal 100 karakter')
    .trim(),
  ownerName: z.string()
    .min(2, 'Nama pemilik minimal 2 karakter')
    .max(100)
    .trim(),
  ownerEmail: z.string()
    .email('Format email tidak valid')
    .max(255)
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .max(128, 'Password terlalu panjang')
    .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf kapital')
    .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka'),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

authRouter.post('/login',    validateBody(loginSchema),    authController.login);
authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.get('/me', authenticate, authController.me);
