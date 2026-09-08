import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '../lib/prisma';
import { authService } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { companyCode, email, password } = req.body;
      if (!companyCode || !email || !password) {
        res.status(400).json({ error: 'Company ID, email, dan password wajib diisi' });
        return;
      }
      const result = await authService.login(companyCode, email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  },

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { companyName, ownerEmail, ownerName, password } = req.body;
      if (!companyName || !ownerEmail || !ownerName || !password) {
        res.status(400).json({ error: 'Semua field wajib diisi (companyName, ownerEmail, ownerName, password)' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password minimal 8 karakter' });
        return;
      }
      const result = await authService.register({ companyName, ownerEmail, ownerName, password });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    try {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          companyId: users.companyId,
          isActive: users.isActive,
          linkedAccountId: users.linkedAccountId,
          canManageUsers: users.canManageUsers,
          canManageSettings: users.canManageSettings,
          canManageCOA: users.canManageCOA,
          canEntryJournal: users.canEntryJournal,
          canApproveJournal: users.canApproveJournal,
          canDeleteJournal: users.canDeleteJournal,
          canViewReports: users.canViewReports,
          canManageInventory: users.canManageInventory,
          canManagePurchasing: users.canManagePurchasing,
          canManageSales: users.canManageSales,
          canOperatePOS: users.canOperatePOS,
          canVoidPOSTransaction: users.canVoidPOSTransaction,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: 'User tidak ditemukan' });
        return;
      }
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
