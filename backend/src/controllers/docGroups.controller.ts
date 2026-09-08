import { Request, Response } from 'express';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db, documentGroups, documentGroupMembers, auditDocuments } from '../lib/prisma';

export const docGroupsController = {

  /** GET /api/doc-groups — semua grup milik company dengan jumlah dokumen */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const groups = await db
        .select()
        .from(documentGroups)
        .where(eq(documentGroups.companyId, cId))
        .orderBy(documentGroups.createdAt);

      // Hitung member per grup
      const counts = await db
        .select({
          groupId: documentGroupMembers.groupId,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(documentGroupMembers)
        .innerJoin(documentGroups, eq(documentGroupMembers.groupId, documentGroups.id))
        .where(eq(documentGroups.companyId, cId))
        .groupBy(documentGroupMembers.groupId);

      const countMap = Object.fromEntries(counts.map(c => [c.groupId, Number(c.count)]));

      res.json(groups.map(g => ({ ...g, documentCount: countMap[g.id] ?? 0 })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/doc-groups — buat grup baru */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, description } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Nama grup wajib diisi.' });
        return;
      }
      await db.insert(documentGroups).values({
        companyId:   cId,
        name:        name.trim(),
        description: description?.trim() || null,
        createdBy:   req.user?.email ?? 'Admin',
      });
      const [created] = await db
        .select()
        .from(documentGroups)
        .where(and(eq(documentGroups.companyId, cId), eq(documentGroups.name, name.trim())))
        .orderBy(documentGroups.createdAt)
        .limit(1);
      res.status(201).json({ ...created, documentCount: 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PUT /api/doc-groups/:id — ubah nama/deskripsi grup */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { name, description } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Nama grup wajib diisi.' });
        return;
      }
      const [existing] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Grup tidak ditemukan.' }); return; }

      await db.update(documentGroups)
        .set({ name: name.trim(), description: description?.trim() || null })
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId)));

      const [updated] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId))).limit(1);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** DELETE /api/doc-groups/:id — hapus grup (members cascade) */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId))).limit(1);
      if (!existing) { res.status(404).json({ error: 'Grup tidak ditemukan.' }); return; }

      await db.delete(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/doc-groups/:id/documents — daftar dokumen dalam grup */
  async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const [group] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId))).limit(1);
      if (!group) { res.status(404).json({ error: 'Grup tidak ditemukan.' }); return; }

      const rows = await db
        .select({ doc: auditDocuments, addedBy: documentGroupMembers.addedBy, addedAt: documentGroupMembers.addedAt })
        .from(documentGroupMembers)
        .innerJoin(auditDocuments, eq(documentGroupMembers.documentId, auditDocuments.id))
        .where(eq(documentGroupMembers.groupId, id))
        .orderBy(documentGroupMembers.addedAt);

      res.json(rows.map(r => ({ ...r.doc, addedBy: r.addedBy, addedAt: r.addedAt })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** POST /api/doc-groups/:id/members — tambah dokumen ke grup */
  async addMembers(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const id = Number(req.params.id);
      const { documentIds } = req.body as { documentIds: number[] };

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ error: 'documentIds wajib berisi minimal 1 ID.' });
        return;
      }

      const [group] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, id), eq(documentGroups.companyId, cId))).limit(1);
      if (!group) { res.status(404).json({ error: 'Grup tidak ditemukan.' }); return; }

      // Validasi dokumen milik company yang sama
      const validDocs = await db.select({ id: auditDocuments.id })
        .from(auditDocuments)
        .where(and(
          eq(auditDocuments.companyId, cId),
          inArray(auditDocuments.id, documentIds),
        ));

      const validIds = validDocs.map(d => d.id);
      if (validIds.length === 0) {
        res.status(400).json({ error: 'Tidak ada dokumen valid yang ditemukan.' });
        return;
      }

      // Ambil yang belum ada agar tidak duplikat
      const existing = await db.select({ documentId: documentGroupMembers.documentId })
        .from(documentGroupMembers)
        .where(and(
          eq(documentGroupMembers.groupId, id),
          inArray(documentGroupMembers.documentId, validIds),
        ));
      const existingIds = new Set(existing.map(e => e.documentId));
      const toInsert = validIds.filter(docId => !existingIds.has(docId));

      if (toInsert.length > 0) {
        await db.insert(documentGroupMembers).values(
          toInsert.map(docId => ({
            groupId:    id,
            documentId: docId,
            addedBy:    req.user?.email ?? 'Admin',
          }))
        );
      }

      res.json({ added: toInsert.length, skipped: validIds.length - toInsert.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** DELETE /api/doc-groups/:id/members/:docId — hapus dokumen dari grup */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const groupId = Number(req.params.id);
      const docId = Number(req.params.docId);

      const [group] = await db.select().from(documentGroups)
        .where(and(eq(documentGroups.id, groupId), eq(documentGroups.companyId, cId))).limit(1);
      if (!group) { res.status(404).json({ error: 'Grup tidak ditemukan.' }); return; }

      await db.delete(documentGroupMembers)
        .where(and(
          eq(documentGroupMembers.groupId, groupId),
          eq(documentGroupMembers.documentId, docId),
        ));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/doc-groups/by-document/:docId — grup mana saja yang berisi dokumen ini */
  async getGroupsByDocument(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const docId = Number(req.params.docId);
      const rows = await db
        .select({ group: documentGroups })
        .from(documentGroupMembers)
        .innerJoin(documentGroups, eq(documentGroupMembers.groupId, documentGroups.id))
        .where(and(
          eq(documentGroupMembers.documentId, docId),
          eq(documentGroups.companyId, cId),
        ));
      res.json(rows.map(r => r.group));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
