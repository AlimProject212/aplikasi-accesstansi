import { Request, Response } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { db, accountBudgets, accounts } from '../lib/prisma';

export const budgetsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const year = (req.query.year as string) || new Date().getFullYear().toString();

      const budgetList = await db.select().from(accountBudgets)
        .where(and(
          eq(accountBudgets.fiscalYear, year),
          eq(accountBudgets.companyId, cId),
        ));

      if (budgetList.length === 0) { res.json([]); return; }

      // Fetch related accounts (no db.query relational API)
      const accountIds = [...new Set(budgetList.map(b => b.accountId))];
      const accountList = await db.select().from(accounts)
        .where(and(
          inArray(accounts.id, accountIds),
          eq(accounts.companyId, cId),
        ));

      const accountsById: Record<string, typeof accountList[0]> = {};
      for (const a of accountList) accountsById[a.id] = a;

      const result = budgetList.map(b => ({ ...b, account: accountsById[b.accountId] ?? null }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async upsertAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year, budgets } = req.body as {
        year: string;
        budgets: { accountId: string; annualAmount: number }[];
      };

      const results = [];
      for (const b of budgets) {
        await db.insert(accountBudgets).values({
          companyId: cId,
          accountId: b.accountId,
          fiscalYear: year,
          annualAmount: b.annualAmount,
        }).onDuplicateKeyUpdate({ set: { annualAmount: b.annualAmount } });

        const [record] = await db.select().from(accountBudgets)
          .where(and(
            eq(accountBudgets.accountId, b.accountId),
            eq(accountBudgets.fiscalYear, year),
            eq(accountBudgets.companyId, cId),
          ))
          .limit(1);
        results.push(record);
      }
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
