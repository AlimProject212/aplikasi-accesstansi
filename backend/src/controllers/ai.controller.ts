import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, apiConfigs } from '../lib/prisma';

export const aiController = {
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Prompt wajib diisi' });
        return;
      }

      // Ambil Gemini API key dari tabel api_configs
      const [keyConfig] = await db.select({ keyValue: apiConfigs.keyValue })
        .from(apiConfigs)
        .where(and(
          eq(apiConfigs.serviceName, 'Google Gemini'),
          eq(apiConfigs.keyName, 'API_KEY'),
          eq(apiConfigs.isActive, true),
        ))
        .limit(1);

      if (!keyConfig) {
        res.status(503).json({
          error: 'API Key Google Gemini belum dikonfigurasi. Silakan tambahkan di Pengaturan > API Keys (Service: "Google Gemini", Key Name: "API_KEY").',
        });
        return;
      }

      // Panggil Gemini REST API (tanpa package tambahan, pakai fetch bawaan Node 18+)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyConfig.keyValue}`;

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!geminiRes.ok) {
        const errData = await geminiRes.json() as any;
        const msg = errData?.error?.message || `Gemini API error: ${geminiRes.status}`;
        res.status(502).json({ error: msg });
        return;
      }

      const data = await geminiRes.json() as any;
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      res.json({ text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // Cek apakah Gemini key sudah terkonfigurasi (tanpa expose nilainya)
  async status(_req: Request, res: Response): Promise<void> {
    try {
      const [keyConfig] = await db.select({ id: apiConfigs.id })
        .from(apiConfigs)
        .where(and(
          eq(apiConfigs.serviceName, 'Google Gemini'),
          eq(apiConfigs.keyName, 'API_KEY'),
          eq(apiConfigs.isActive, true),
        ))
        .limit(1);

      res.json({ configured: !!keyConfig });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
