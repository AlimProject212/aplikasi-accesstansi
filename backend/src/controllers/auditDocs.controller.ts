import { Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { db, auditDocuments } from '../lib/prisma';
import { UPLOAD_DIR } from '../middleware/multer';

export const auditDocsController = {

  /** GET /api/audit-docs?year=2024 */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { year } = req.query;
      const rows = year
        ? await db.select().from(auditDocuments)
            .where(and(
              eq(auditDocuments.companyId, cId),
              eq(auditDocuments.year, year as string),
            ))
            .orderBy(desc(auditDocuments.createdAt))
        : await db.select().from(auditDocuments)
            .where(eq(auditDocuments.companyId, cId))
            .orderBy(desc(auditDocuments.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/audit-docs/upload  (multipart/form-data) */
  async upload(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      if (!req.file) {
        res.status(400).json({ error: 'File tidak ditemukan dalam request.' });
        return;
      }

      const { category, year, journalRef } = req.body;
      if (!category || !year) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Field category dan year wajib diisi.' });
        return;
      }

      const sizeBytes = req.file.size;
      const fileSize =
        sizeBytes > 1024 * 1024
          ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
          : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;

      const userName = req.user?.email ?? 'Admin';

      await db.insert(auditDocuments).values({
        companyId:  cId,
        name:       req.file.originalname,
        category,
        year,
        status:     'YELLOW',
        uploadedBy: userName,
        fileSize,
        filePath:   req.file.filename,
        mimeType:   req.file.mimetype,
        journalRef: journalRef || null,
      });

      const [created] = await db
        .select()
        .from(auditDocuments)
        .where(and(
          eq(auditDocuments.filePath, req.file.filename),
          eq(auditDocuments.companyId, cId),
        ))
        .limit(1);

      res.status(201).json(created);
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: err.message });
    }
  },

  /** PATCH /api/audit-docs/:id/status */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { status } = req.body;
      if (!['RED', 'YELLOW', 'GREEN'].includes(status)) {
        res.status(400).json({ error: 'Status tidak valid.' });
        return;
      }
      await db.update(auditDocuments)
        .set({ status })
        .where(and(eq(auditDocuments.id, id), eq(auditDocuments.companyId, cId)));
      const [doc] = await db.select().from(auditDocuments)
        .where(and(eq(auditDocuments.id, id), eq(auditDocuments.companyId, cId))).limit(1);
      if (!doc) { res.status(404).json({ error: 'Dokumen tidak ditemukan.' }); return; }
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/audit-docs/:id/download */
  async download(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [doc] = await db.select().from(auditDocuments)
        .where(and(eq(auditDocuments.id, id), eq(auditDocuments.companyId, cId))).limit(1);
      if (!doc) { res.status(404).json({ error: 'Dokumen tidak ditemukan.' }); return; }

      const filePath = path.join(UPLOAD_DIR, doc.filePath);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File tidak ditemukan di server.' });
        return;
      }
      res.download(filePath, doc.name);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** DELETE /api/audit-docs/:id */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [doc] = await db.select().from(auditDocuments)
        .where(and(eq(auditDocuments.id, id), eq(auditDocuments.companyId, cId))).limit(1);
      if (!doc) { res.status(404).json({ error: 'Dokumen tidak ditemukan.' }); return; }

      const filePath = path.join(UPLOAD_DIR, doc.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await db.delete(auditDocuments)
        .where(and(eq(auditDocuments.id, id), eq(auditDocuments.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
