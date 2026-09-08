// @ts-ignore - pdfjs-dist tidak selalu punya types lengkap untuk semua build target
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - worker di-bundle Vite lewat ?url, bukan modul JS biasa
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const MIN_CHARS_FOR_DIGITAL_PAGE = 20;
const RENDER_SCALE = 300 / 72; // ~300 DPI, cukup buat OCR akurat

export interface StatementToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StatementPageText {
  pageNum: number;
  tokens: StatementToken[];
}

export interface AnalyzedStatementFile {
  mode: 'digital' | 'ocr';
  pageCount: number;
  textLayer?: { pages: StatementPageText[] };
  pageImages?: Blob[];
}

/** Dilempar kalau PDF terkunci password — `wasIncorrect` true kalau password yang dimasukkan salah (bukan sekadar belum diisi). */
export class PdfPasswordRequiredError extends Error {
  wasIncorrect: boolean;
  constructor(wasIncorrect: boolean) {
    super(wasIncorrect ? 'Password PDF yang dimasukkan salah.' : 'Dokumen PDF ini terkunci password.');
    this.name = 'PdfPasswordRequiredError';
    this.wasIncorrect = wasIncorrect;
  }
}

/**
 * Deteksi apakah file rekening koran (PDF/gambar) punya text layer asli (PDF digital)
 * atau perlu OCR (hasil scan/foto). Untuk PDF digital, token teks + posisi diekstrak
 * langsung dari halaman. Untuk jalur OCR, tiap halaman dirender jadi PNG di browser
 * (tanpa perlu Imagick/Ghostscript di server). `password` dipakai untuk PDF terkunci
 * (rekening koran e-statement biasanya dilindungi password oleh bank penerbit).
 */
export async function analyzeStatementFile(file: File, password?: string): Promise<AnalyzedStatementFile> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    // Foto/scan tunggal (JPG/PNG) -> langsung jalur OCR, tidak perlu pdfjs
    return { mode: 'ocr', pageCount: 1, pageImages: [file] };
  }

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: buffer, password: password || undefined }).promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      const wasIncorrect = err.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
      throw new PdfPasswordRequiredError(wasIncorrect);
    }
    throw err;
  }

  const pagesText: StatementPageText[] = [];
  let allPagesDigital = pdf.numPages > 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const tokens: StatementToken[] = (content.items as any[])
      .filter((item) => typeof item.str === 'string' && item.str.trim())
      .map((item) => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width || Math.abs(item.transform[0]) * item.str.length,
        height: item.height || Math.abs(item.transform[3]) || 10,
      }));

    const totalChars = tokens.reduce((sum, t) => sum + t.text.length, 0);
    if (totalChars < MIN_CHARS_FOR_DIGITAL_PAGE) allPagesDigital = false;

    pagesText.push({ pageNum, tokens });
  }

  if (allPagesDigital) {
    return { mode: 'digital', pageCount: pdf.numPages, textLayer: { pages: pagesText } };
  }

  // Minimal ada 1 halaman tanpa text layer -> render semua halaman jadi gambar (jalur OCR)
  const pageImages: Blob[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung rendering canvas.');
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal merender halaman ke gambar.'))), 'image/png')
    );
    pageImages.push(blob);
  }

  return { mode: 'ocr', pageCount: pdf.numPages, pageImages };
}
