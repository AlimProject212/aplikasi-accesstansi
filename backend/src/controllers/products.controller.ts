import { Request, Response } from 'express';
import { eq, and, or, like, asc } from 'drizzle-orm';
import { db, products, productCategories, units } from '../lib/prisma';

export const productsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { search, categoryId, isActive } = req.query;
      const s = search ? `%${search}%` : null;

      const result = await db.select({
        id: products.id,
        companyId: products.companyId,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        unitId: products.unitId,
        unitAbbreviation: units.abbreviation,
        purchasePrice: products.purchasePrice,
        sellPrice: products.sellPrice,
        minStock: products.minStock,
        currentStock: products.currentStock,
        avgCost: products.avgCost,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      }).from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .leftJoin(units, eq(products.unitId, units.id))
        .where(and(
          eq(products.companyId, cId),
          categoryId ? eq(products.categoryId, Number(categoryId)) : undefined,
          isActive !== undefined ? eq(products.isActive, isActive === 'true') : undefined,
          s ? or(
            like(products.name, s),
            like(products.sku, s),
            like(products.barcode, s),
          ) : undefined,
        ))
        .orderBy(asc(products.name));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [product] = await db.select().from(products)
        .where(and(eq(products.id, req.params.id), eq(products.companyId, cId))).limit(1);
      if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }
      res.json(product);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id, sku, barcode, name, categoryId, unitId, purchasePrice, sellPrice, minStock } = req.body;
      if (!sku?.trim() || !name?.trim()) {
        res.status(400).json({ error: 'SKU dan nama produk wajib diisi.' });
        return;
      }

      const [existing] = await db.select({ id: products.id }).from(products)
        .where(and(eq(products.companyId, cId), eq(products.sku, sku.trim()))).limit(1);
      if (existing) { res.status(400).json({ error: 'SKU ini sudah dipakai produk lain.' }); return; }

      const newId = id || crypto.randomUUID();
      await db.insert(products).values({
        id: newId,
        companyId: cId,
        sku: sku.trim(),
        barcode: barcode?.trim() || null,
        name: name.trim(),
        categoryId: categoryId || null,
        unitId: unitId || null,
        purchasePrice: purchasePrice || 0,
        sellPrice: sellPrice || 0,
        minStock: minStock || 0,
        currentStock: 0,
        avgCost: 0,
      });

      const [product] = await db.select().from(products)
        .where(and(eq(products.id, newId), eq(products.companyId, cId))).limit(1);
      res.status(201).json(product);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { sku, barcode, name, categoryId, unitId, purchasePrice, sellPrice, minStock, isActive } = req.body;

      const [existing] = await db.select().from(products)
        .where(and(eq(products.id, req.params.id), eq(products.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }

      if (sku !== undefined && sku.trim() !== existing.sku) {
        const [dup] = await db.select({ id: products.id }).from(products)
          .where(and(eq(products.companyId, cId), eq(products.sku, sku.trim()))).limit(1);
        if (dup) { res.status(400).json({ error: 'SKU ini sudah dipakai produk lain.' }); return; }
      }

      const updateData: Record<string, any> = {};
      if (sku !== undefined) updateData.sku = sku.trim();
      if (barcode !== undefined) updateData.barcode = barcode?.trim() || null;
      if (name !== undefined) updateData.name = name.trim();
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (unitId !== undefined) updateData.unitId = unitId || null;
      if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
      if (sellPrice !== undefined) updateData.sellPrice = sellPrice;
      if (minStock !== undefined) updateData.minStock = minStock;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      if (Object.keys(updateData).length > 0) {
        await db.update(products).set(updateData)
          .where(and(eq(products.id, req.params.id), eq(products.companyId, cId)));
      }
      const [product] = await db.select().from(products)
        .where(and(eq(products.id, req.params.id), eq(products.companyId, cId))).limit(1);
      res.json(product);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [product] = await db.select().from(products)
        .where(and(eq(products.id, req.params.id), eq(products.companyId, cId))).limit(1);
      if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }
      if (product.currentStock !== 0) {
        res.status(400).json({ error: 'Produk dengan stok tidak boleh dihapus — nonaktifkan saja produknya.' });
        return;
      }

      await db.delete(products)
        .where(and(eq(products.id, req.params.id), eq(products.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
