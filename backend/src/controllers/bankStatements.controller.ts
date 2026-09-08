import { Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs';
import { db, accounts, bankStatementKeywords } from '../lib/prisma';
import { Token } from '../lib/bankStatements/types';
import { runBankStatementPipeline } from '../lib/bankStatements/pipeline';
import { ocrImagesToTokens } from '../lib/bankStatements/ocr';
import { reinforceKeywords } from '../lib/bankStatements/coaSuggest';

interface MulterFiles {
  file?: Express.Multer.File[];
  pageImages?: Express.Multer.File[];
}

function cleanupFiles(files: MulterFiles | undefined) {
  if (!files) return;
  const all = [...(files.file || []), ...(files.pageImages || [])];
  for (const f of all) {
    if (fs.existsSync(f.path)) {
      try { fs.unlinkSync(f.path); } catch { /* noop */ }
    }
  }
}

export const bankStatementsController = {
  /** POST /api/bank-statements/parse (multipart/form-data) */
  async parse(req: Request, res: Response): Promise<void> {
    const files = req.files as MulterFiles | undefined;
    try {
      const cId = req.user!.companyId;
      const { mode, textLayer, bankHint } = req.body as {
        mode?: string;
        textLayer?: string;
        bankHint?: string;
      };

      if (mode !== 'digital' && mode !== 'ocr') {
        res.status(400).json({ error: "Field 'mode' wajib diisi 'digital' atau 'ocr'." });
        return;
      }

      let tokens: Token[] = [];

      if (mode === 'digital') {
        if (!textLayer) {
          res.status(400).json({ error: "Field 'textLayer' wajib diisi untuk mode digital." });
          return;
        }
        let parsed: { pages: { pageNum: number; tokens: Omit<Token, 'page'>[] }[] };
        try {
          parsed = JSON.parse(textLayer);
        } catch {
          res.status(400).json({ error: 'textLayer bukan JSON yang valid.' });
          return;
        }
        tokens = (parsed.pages || []).flatMap((p) =>
          (p.tokens || []).map((t) => ({ ...t, page: p.pageNum }))
        );
      } else {
        const pageImages = files?.pageImages;
        const originalFile = files?.file?.[0];
        const sourceFiles = pageImages && pageImages.length ? pageImages : originalFile ? [originalFile] : [];

        if (!sourceFiles.length) {
          res.status(400).json({ error: 'Tidak ada gambar untuk diproses OCR.' });
          return;
        }

        const images = sourceFiles.map((f, idx) => ({
          buffer: fs.readFileSync(f.path),
          page: idx + 1,
        }));
        tokens = await ocrImagesToTokens(images);
      }

      if (!tokens.length) {
        res.status(400).json({ error: 'Tidak ada teks yang berhasil diekstrak dari dokumen ini.' });
        return;
      }

      const result = await runBankStatementPipeline(cId, tokens, bankHint || null);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal memproses rekening koran.' });
    } finally {
      cleanupFiles(files);
    }
  },

  /** POST /api/bank-statements/keywords/reinforce */
  async reinforceKeywords(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const { entries } = req.body as { entries?: { accountId: string; description: string }[] };
      if (!Array.isArray(entries) || !entries.length) {
        res.status(400).json({ error: "Field 'entries' wajib diisi." });
        return;
      }
      await reinforceKeywords(cId, entries);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /api/bank-statements/keywords */
  async listKeywords(req: Request, res: Response): Promise<void> {
    try {
      const cId = req.user!.companyId;
      const rows = await db
        .select({
          id: bankStatementKeywords.id,
          keyword: bankStatementKeywords.keyword,
          matchCount: bankStatementKeywords.matchCount,
          accountId: bankStatementKeywords.accountId,
          accountCode: accounts.code,
          accountName: accounts.name,
          updatedAt: bankStatementKeywords.updatedAt,
        })
        .from(bankStatementKeywords)
        .innerJoin(accounts, eq(bankStatementKeywords.accountId, accounts.id))
        .where(eq(bankStatementKeywords.companyId, cId))
        .orderBy(desc(bankStatementKeywords.matchCount));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
