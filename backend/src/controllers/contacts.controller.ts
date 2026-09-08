import { Request, Response } from 'express';
import { eq, asc, and, or, like, count } from 'drizzle-orm';
import { db, contacts, journalLines } from '../lib/prisma';

export const contactsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { type, search } = req.query;
      const s = search ? `%${search}%` : null;

      const result = await db.select().from(contacts)
        .where(and(
          eq(contacts.companyId, cId),
          type && type !== 'ALL' ? eq(contacts.type, type as any) : undefined,
          s ? or(
            like(contacts.name, s),
            like(contacts.email, s),
            like(contacts.phone, s),
          ) : undefined,
        ))
        .orderBy(asc(contacts.name));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [contact] = await db.select().from(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.companyId, cId))).limit(1);
      if (!contact) { res.status(404).json({ error: 'Kontak tidak ditemukan' }); return; }
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { id, name, type, email, phone, address, taxId, notes } = req.body;
      const newId = id || crypto.randomUUID();
      await db.insert(contacts).values({
        id: newId, companyId: cId, name, type,
        email: email ?? null, phone: phone ?? null,
        address: address ?? null, taxId: taxId ?? null, notes: notes ?? null,
      });
      const [contact] = await db.select().from(contacts)
        .where(and(eq(contacts.id, newId), eq(contacts.companyId, cId))).limit(1);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { name, type, email, phone, address, taxId, notes } = req.body;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (taxId !== undefined) updateData.taxId = taxId;
      if (notes !== undefined) updateData.notes = notes;

      if (Object.keys(updateData).length > 0) {
        await db.update(contacts).set(updateData)
          .where(and(eq(contacts.id, req.params.id), eq(contacts.companyId, cId)));
      }
      const [contact] = await db.select().from(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.companyId, cId))).limit(1);
      if (!contact) { res.status(404).json({ error: 'Kontak tidak ditemukan' }); return; }
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const [{ total }] = await db.select({ total: count() }).from(journalLines)
        .where(eq(journalLines.contactId, req.params.id));
      if (total > 0) {
        res.status(400).json({ error: 'Kontak tidak bisa dihapus karena sudah digunakan dalam jurnal' });
        return;
      }
      await db.delete(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.companyId, cId)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
