import { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, documentCategories, auditDocuments } from '../lib/prisma';

const DEFAULT_CATEGORIES = [
  { label: 'Legalitas',   categoryKey: 'LEGAL',       description: 'Akta pendirian, TDP, NIB, Izin Operasional',                   sortOrder: 1 },
  { label: 'Keuangan',    categoryKey: 'FINANCE',      description: 'Laporan audit tahun sebelumnya, rekonsiliasi bank tahunan',      sortOrder: 2 },
  { label: 'Perpajakan',  categoryKey: 'TAX',          description: 'SPT Tahunan, bukti potong, SSP',                                sortOrder: 3 },
  { label: 'Operasional', categoryKey: 'OPERATIONAL',  description: 'Kontrak dengan supplier dan lainnya',                           sortOrder: 4 },
  { label: 'Lainnya',     categoryKey: 'OTHER',        description: 'Dokumen pendukung lainnya',                                     sortOrder: 5 },
];

export const docCategoriesController = {

  /** GET /api/doc-categories */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      let cats = await db.select().from(documentCategories)
        .where(eq(documentCategories.companyId, cId))
        .orderBy(documentCategories.sortOrder, documentCategories.createdAt);

      if (cats.length === 0) {
        await db.insert(documentCategories).values(
          DEFAULT_CATEGORIES.map(c => ({ ...c, companyId: cId, isDefault: true }))
        );
        cats = await db.select().from(documentCategories)
          .where(eq(documentCategories.companyId, cId))
          .orderBy(documentCategories.sortOrder, documentCategories.createdAt);
      }

      res.json(cats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/doc-categories */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { label, description } = req.body;
      if (!label?.trim()) {
        res.status(400).json({ error: 'Nama kategori wajib diisi.' });
        return;
      }

      const categoryKey = label.trim().toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const [existing] = await db.select().from(documentCategories)
        .where(and(eq(documentCategories.companyId, cId), eq(documentCategories.categoryKey, categoryKey)))
        .limit(1);
      if (existing) {
        res.status(400).json({ error: 'Kategori dengan nama serupa sudah ada.' });
        return;
      }

      const [maxRow] = await db
        .select({ max: sql<number>`MAX(sortOrder)` })
        .from(documentCategories)
        .where(eq(documentCategories.companyId, cId));
      const sortOrder = (Number(maxRow?.max) || 0) + 1;

      await db.insert(documentCategories).values({
        companyId:   cId,
        label:       label.trim(),
        categoryKey,
        description: description?.trim() || null,
        isDefault:   false,
        sortOrder,
      });

      const [created] = await db.select().from(documentCategories)
        .where(and(eq(documentCategories.companyId, cId), eq(documentCategories.categoryKey, categoryKey)))
        .limit(1);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PUT /api/doc-categories/:id */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { label, description } = req.body;
      if (!label?.trim()) {
        res.status(400).json({ error: 'Nama kategori wajib diisi.' });
        return;
      }

      const [cat] = await db.select().from(documentCategories)
        .where(and(eq(documentCategories.id, id), eq(documentCategories.companyId, cId))).limit(1);
      if (!cat) { res.status(404).json({ error: 'Kategori tidak ditemukan.' }); return; }

      await db.update(documentCategories)
        .set({ label: label.trim(), description: description?.trim() || null })
        .where(and(eq(documentCategories.id, id), eq(documentCategories.companyId, cId)));

      const [updated] = await db.select().from(documentCategories)
        .where(and(eq(documentCategories.id, id), eq(documentCategories.companyId, cId))).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** DELETE /api/doc-categories/:id */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);

      const [cat] = await db.select().from(documentCategories)
        .where(and(eq(documentCategories.id, id), eq(documentCategories.companyId, cId))).limit(1);
      if (!cat) { res.status(404).json({ error: 'Kategori tidak ditemukan.' }); return; }
      if (cat.isDefault) {
        res.status(400).json({ error: 'Kategori bawaan tidak dapat dihapus.' });
        return;
      }

      const [docCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditDocuments)
        .where(and(eq(auditDocuments.companyId, cId), eq(auditDocuments.category, cat.categoryKey)));
      if (Number(docCount?.count) > 0) {
        res.status(400).json({ error: `Tidak bisa dihapus — ada ${docCount.count} dokumen menggunakan kategori ini.` });
        return;
      }

      await db.delete(documentCategories)
        .where(and(eq(documentCategories.id, id), eq(documentCategories.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
