import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, inventorySettings, accounts } from '../lib/prisma';

export const inventorySettingsController = {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      await db.insert(inventorySettings)
        .values({ id: cId })
        .onDuplicateKeyUpdate({ set: { id: cId } });
      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const {
        inventoryAccountId, stockAdjustmentAccountId, payableAccountId,
        receivableAccountId, salesRevenueAccountId, cogsAccountId, salesTaxAccountId,
        posCashAccountId, posTransferAccountId, posQrisAccountId, posCardAccountId,
      } = req.body;

      // Validasi akun ada & milik company yang sama
      for (const accId of [
        inventoryAccountId, stockAdjustmentAccountId, payableAccountId,
        receivableAccountId, salesRevenueAccountId, cogsAccountId, salesTaxAccountId,
        posCashAccountId, posTransferAccountId, posQrisAccountId, posCardAccountId,
      ]) {
        if (!accId) continue;
        const [acc] = await db.select({ id: accounts.id }).from(accounts)
          .where(and(eq(accounts.id, accId), eq(accounts.companyId, cId))).limit(1);
        if (!acc) { res.status(400).json({ error: 'Salah satu akun yang dipilih tidak ditemukan.' }); return; }
      }

      const values = {
        inventoryAccountId: inventoryAccountId ?? null,
        stockAdjustmentAccountId: stockAdjustmentAccountId ?? null,
        payableAccountId: payableAccountId ?? null,
        receivableAccountId: receivableAccountId ?? null,
        salesRevenueAccountId: salesRevenueAccountId ?? null,
        cogsAccountId: cogsAccountId ?? null,
        salesTaxAccountId: salesTaxAccountId ?? null,
        posCashAccountId: posCashAccountId ?? null,
        posTransferAccountId: posTransferAccountId ?? null,
        posQrisAccountId: posQrisAccountId ?? null,
        posCardAccountId: posCardAccountId ?? null,
      };
      await db.insert(inventorySettings)
        .values({ id: cId, ...values })
        .onDuplicateKeyUpdate({ set: values });

      const [settings] = await db.select().from(inventorySettings).where(eq(inventorySettings.id, cId)).limit(1);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
