import { Request, Response } from 'express';
import { eq, asc, and, count } from 'drizzle-orm';
import { db, accounts, journalLines } from '../lib/prisma';

export const accountsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const result = await db.select().from(accounts)
        .where(eq(accounts.companyId, cId))
        .orderBy(asc(accounts.level), asc(accounts.code));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [account] = await db.select().from(accounts)
        .where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, cId))).limit(1);
      if (!account) { res.status(404).json({ error: 'Akun tidak ditemukan' }); return; }
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id, code, name, type, level, parentId, balance, isHeader, cashFlowCategory } = req.body;
      const newId = id || crypto.randomUUID();
      await db.insert(accounts).values({
        id: newId, companyId: cId, code, name, type, level,
        parentId: parentId ?? null,
        balance: balance ?? 0,
        isHeader: isHeader ?? false,
        cashFlowCategory: cashFlowCategory ?? null,
      });
      const [account] = await db.select().from(accounts)
        .where(and(eq(accounts.id, newId), eq(accounts.companyId, cId))).limit(1);
      res.status(201).json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { code, name, type, level, parentId, balance, isHeader, cashFlowCategory } = req.body;
      const updateData: Record<string, any> = {};
      if (code !== undefined) updateData.code = code;
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (level !== undefined) updateData.level = level;
      if (parentId !== undefined) updateData.parentId = parentId ?? null;
      if (balance !== undefined) updateData.balance = balance;
      if (isHeader !== undefined) updateData.isHeader = isHeader;
      if (cashFlowCategory !== undefined) updateData.cashFlowCategory = cashFlowCategory ?? null;

      if (Object.keys(updateData).length > 0) {
        await db.update(accounts).set(updateData)
          .where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, cId)));
      }
      const [account] = await db.select().from(accounts)
        .where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, cId))).limit(1);
      if (!account) { res.status(404).json({ error: 'Akun tidak ditemukan' }); return; }
      res.json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [{ total }] = await db.select({ total: count() }).from(journalLines)
        .where(eq(journalLines.accountId, req.params.id));
      if (total > 0) {
        res.status(400).json({ error: 'Akun tidak bisa dihapus karena sudah digunakan dalam jurnal' });
        return;
      }
      await db.delete(accounts)
        .where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { accounts: accs, replace } = req.body as { accounts: any[]; replace?: boolean };
      if (replace) {
        // Hanya hapus akun milik company ini
        await db.delete(accounts).where(eq(accounts.companyId, cId));
      }
      // Insert in level order (parents before children)
      const sorted = [...accs].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
      const created: any[] = [];
      for (const acc of sorted) {
        const { children, ...data } = acc;
        const id = data.id || crypto.randomUUID();
        await db.insert(accounts).values({
          id,
          companyId: cId,
          code: data.code, name: data.name, type: data.type,
          level: data.level, parentId: data.parentId ?? null,
          balance: data.balance ?? 0, isHeader: data.isHeader ?? false,
          cashFlowCategory: data.cashFlowCategory ?? null,
        }).onDuplicateKeyUpdate({
          set: {
            name: data.name, type: data.type, level: data.level,
            parentId: data.parentId ?? null, balance: data.balance ?? 0,
            isHeader: data.isHeader ?? false, cashFlowCategory: data.cashFlowCategory ?? null,
          },
        });
        const [record] = await db.select().from(accounts)
          .where(and(eq(accounts.id, id), eq(accounts.companyId, cId))).limit(1);
        created.push(record);
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async updateCashFlow(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { updates } = req.body as { updates: { id: string; cashFlowCategory: string | null }[] };
      for (const u of updates) {
        await db.update(accounts)
          .set({ cashFlowCategory: (u.cashFlowCategory as any) ?? null })
          .where(and(eq(accounts.id, u.id), eq(accounts.companyId, cId)));
      }
      res.json({ updated: updates.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
