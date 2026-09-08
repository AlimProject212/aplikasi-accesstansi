import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, apiConfigs } from '../lib/prisma';

// Mask: tampilkan 4 karakter pertama + •••• + 4 karakter terakhir
function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

export const apiKeysController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const keys = await db.select().from(apiConfigs)
        .where(eq(apiConfigs.companyId, cId))
        .orderBy(apiConfigs.serviceName);
      res.json(keys.map(k => ({ ...k, keyValue: maskValue(k.keyValue) })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { serviceName, keyName, keyValue, description, isActive } = req.body;

      if (!serviceName || !keyName || !keyValue) {
        res.status(400).json({ error: 'serviceName, keyName, dan keyValue wajib diisi' });
        return;
      }

      const result = await db.insert(apiConfigs).values({
        companyId:   cId,
        serviceName: serviceName.trim(),
        keyName:     keyName.trim(),
        keyValue:    keyValue.trim(),
        description: description?.trim() || null,
        isActive:    isActive !== undefined ? Boolean(isActive) : true,
      });

      const insertId = (result as any).insertId;
      const [created] = await db.select().from(apiConfigs)
        .where(and(eq(apiConfigs.id, insertId), eq(apiConfigs.companyId, cId))).limit(1);

      res.status(201).json({ ...created, keyValue: maskValue(created.keyValue) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(apiConfigs)
        .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'API Key tidak ditemukan' }); return; }

      const { serviceName, keyName, keyValue, description, isActive } = req.body;
      const updateData: Record<string, any> = {};

      if (serviceName !== undefined) updateData.serviceName = serviceName.trim();
      if (keyName !== undefined) updateData.keyName = keyName.trim();
      if (keyValue !== undefined && keyValue !== '') updateData.keyValue = keyValue.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      if (Object.keys(updateData).length > 0) {
        await db.update(apiConfigs).set(updateData)
          .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId)));
      }

      const [updated] = await db.select().from(apiConfigs)
        .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId))).limit(1);
      res.json({ ...updated, keyValue: maskValue(updated.keyValue) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(apiConfigs)
        .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'API Key tidak ditemukan' }); return; }

      await db.delete(apiConfigs)
        .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  // Reveal nilai asli key (hanya admin/superadmin)
  async reveal(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [key] = await db.select({ keyValue: apiConfigs.keyValue })
        .from(apiConfigs)
        .where(and(eq(apiConfigs.id, id), eq(apiConfigs.companyId, cId))).limit(1);

      if (!key) { res.status(404).json({ error: 'API Key tidak ditemukan' }); return; }
      res.json({ keyValue: key.keyValue });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
