import { Request, Response } from 'express';
import { eq, and, asc, count } from 'drizzle-orm';
import { db, productCategories, products } from '../lib/prisma';

export const productCategoriesController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const cats = await db.select().from(productCategories)
        .where(eq(productCategories.companyId, cId))
        .orderBy(asc(productCategories.name));
      res.json(cats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: 'Nama kategori wajib diisi.' }); return; }

      const [existing] = await db.select().from(productCategories)
        .where(and(eq(productCategories.companyId, cId), eq(productCategories.name, name.trim()))).limit(1);
      if (existing) { res.status(400).json({ error: 'Kategori dengan nama ini sudah ada.' }); return; }

      const result = await db.insert(productCategories).values({ companyId: cId, name: name.trim() });
      const insertId = (result as any).insertId;
      const [created] = await db.select().from(productCategories)
        .where(and(eq(productCategories.id, insertId), eq(productCategories.companyId, cId))).limit(1);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { name } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: 'Nama kategori wajib diisi.' }); return; }

      const [cat] = await db.select().from(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.companyId, cId))).limit(1);
      if (!cat) { res.status(404).json({ error: 'Kategori tidak ditemukan.' }); return; }

      await db.update(productCategories).set({ name: name.trim() })
        .where(and(eq(productCategories.id, id), eq(productCategories.companyId, cId)));
      const [updated] = await db.select().from(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.companyId, cId))).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);

      const [cat] = await db.select().from(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.companyId, cId))).limit(1);
      if (!cat) { res.status(404).json({ error: 'Kategori tidak ditemukan.' }); return; }

      const [{ total }] = await db.select({ total: count() }).from(products)
        .where(and(eq(products.categoryId, id), eq(products.companyId, cId)));
      if (total > 0) {
        res.status(400).json({ error: `Tidak bisa dihapus — ada ${total} produk menggunakan kategori ini.` });
        return;
      }

      await db.delete(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
