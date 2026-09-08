import { Request, Response } from 'express';
import { eq, and, asc, count } from 'drizzle-orm';
import { db, units, products } from '../lib/prisma';

const DEFAULT_UNITS = [
  { name: 'Pieces', abbreviation: 'pcs' },
  { name: 'Kotak',  abbreviation: 'box' },
  { name: 'Lusin',  abbreviation: 'lsn' },
  { name: 'Kilogram', abbreviation: 'kg' },
  { name: 'Dus',    abbreviation: 'dus' },
];

export const unitsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      let list = await db.select().from(units)
        .where(eq(units.companyId, cId))
        .orderBy(asc(units.name));

      if (list.length === 0) {
        await db.insert(units).values(DEFAULT_UNITS.map(u => ({ ...u, companyId: cId })));
        list = await db.select().from(units)
          .where(eq(units.companyId, cId))
          .orderBy(asc(units.name));
      }

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, abbreviation } = req.body;
      if (!name?.trim() || !abbreviation?.trim()) {
        res.status(400).json({ error: 'Nama dan singkatan satuan wajib diisi.' });
        return;
      }

      const [existing] = await db.select().from(units)
        .where(and(eq(units.companyId, cId), eq(units.name, name.trim()))).limit(1);
      if (existing) { res.status(400).json({ error: 'Satuan dengan nama ini sudah ada.' }); return; }

      const result = await db.insert(units).values({ companyId: cId, name: name.trim(), abbreviation: abbreviation.trim() });
      const insertId = (result as any).insertId;
      const [created] = await db.select().from(units)
        .where(and(eq(units.id, insertId), eq(units.companyId, cId))).limit(1);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { name, abbreviation } = req.body;
      if (!name?.trim() || !abbreviation?.trim()) {
        res.status(400).json({ error: 'Nama dan singkatan satuan wajib diisi.' });
        return;
      }

      const [unit] = await db.select().from(units)
        .where(and(eq(units.id, id), eq(units.companyId, cId))).limit(1);
      if (!unit) { res.status(404).json({ error: 'Satuan tidak ditemukan.' }); return; }

      await db.update(units).set({ name: name.trim(), abbreviation: abbreviation.trim() })
        .where(and(eq(units.id, id), eq(units.companyId, cId)));
      const [updated] = await db.select().from(units)
        .where(and(eq(units.id, id), eq(units.companyId, cId))).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);

      const [unit] = await db.select().from(units)
        .where(and(eq(units.id, id), eq(units.companyId, cId))).limit(1);
      if (!unit) { res.status(404).json({ error: 'Satuan tidak ditemukan.' }); return; }

      const [{ total }] = await db.select({ total: count() }).from(products)
        .where(and(eq(products.unitId, id), eq(products.companyId, cId)));
      if (total > 0) {
        res.status(400).json({ error: `Tidak bisa dihapus — ada ${total} produk menggunakan satuan ini.` });
        return;
      }

      await db.delete(units)
        .where(and(eq(units.id, id), eq(units.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
