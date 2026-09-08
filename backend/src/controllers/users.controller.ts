import { Request, Response } from 'express';
import { eq, asc, and } from 'drizzle-orm';
import { db, users } from '../lib/prisma';
import { authService } from '../services/auth.service';

const userSelect = {
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
};

export const usersController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const result = await db.select(userSelect).from(users)
        .where(eq(users.companyId, cId))
        .orderBy(asc(users.name));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [user] = await db.select(userSelect).from(users)
        .where(and(eq(users.id, Number(req.params.id)), eq(users.companyId, cId))).limit(1);
      if (!user) { res.status(404).json({ error: 'User tidak ditemukan' }); return; }
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, email, password, role, linkedAccountId, ...permissions } = req.body;
      if (!password) { res.status(400).json({ error: 'Password wajib diisi' }); return; }
      const passwordHash = await authService.hashPassword(password);
      await db.insert(users).values({
        companyId: cId,
        name, email, passwordHash,
        role: role || 'ACCOUNTANT',
        linkedAccountId: linkedAccountId || null,
        ...permissions,
      });
      // Re-query by email (globally unique) to get created user
      const [user] = await db.select(userSelect).from(users)
        .where(and(eq(users.email, email), eq(users.companyId, cId))).limit(1);
      res.status(201).json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, email, role, isActive, linkedAccountId, ...permissions } = req.body;
      const updateData: Record<string, any> = { ...permissions };
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (linkedAccountId !== undefined) updateData.linkedAccountId = linkedAccountId || null;

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData)
          .where(and(eq(users.id, Number(req.params.id)), eq(users.companyId, cId)));
      }
      const [user] = await db.select(userSelect).from(users)
        .where(and(eq(users.id, Number(req.params.id)), eq(users.companyId, cId))).limit(1);
      if (!user) { res.status(404).json({ error: 'User tidak ditemukan' }); return; }
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      if (req.user!.id === Number(req.params.id)) {
        res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
        return;
      }
      // Soft delete: set isActive = false (hanya user dalam company yang sama)
      await db.update(users).set({ isActive: false })
        .where(and(eq(users.id, Number(req.params.id)), eq(users.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const targetId = Number(req.params.id);
      const isOwnAccount = req.user!.id === targetId;
      const isAdmin = ['SUPERADMIN', 'ADMIN'].includes(req.user!.role);

      if (!isOwnAccount && !isAdmin) {
        res.status(403).json({ error: 'Tidak punya akses untuk mengubah password user lain' });
        return;
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ error: 'Password baru wajib diisi dan minimal 6 karakter' });
        return;
      }
      const passwordHash = await authService.hashPassword(newPassword);
      await db.update(users).set({ passwordHash })
        .where(and(eq(users.id, targetId), eq(users.companyId, cId)));
      res.json({ message: 'Password berhasil diubah' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
