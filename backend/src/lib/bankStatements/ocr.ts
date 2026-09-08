import { createWorker } from 'tesseract.js';
import { Token } from './types';

// Catatan: preprocessing gambar (grayscale/threshold) sebelumnya pakai `sharp`, tapi
// paket itu butuh compile/download binary native yang berat pas `npm install` di shared
// hosting ber-resource-limit ketat (CloudLinux LVE). Karena jalur OCR ini kasusnya jarang
// dipakai (statement biasanya PDF asli, bukan scan), preprocessing dilepas demi instalasi
// yang lebih ringan — akurasi OCR untuk dokumen hasil scan/foto jadi sedikit lebih rendah.

interface PageImage {
  buffer: Buffer;
  page: number;
}

/** Jalankan OCR per halaman (worker Tesseract di-reuse antar halaman) dan kembalikan token setara text-layer PDF, lengkap dengan confidence per kata. */
export async function ocrImagesToTokens(images: PageImage[]): Promise<Token[]> {
  const worker = await createWorker('ind');
  try {
    const allTokens: Token[] = [];
    for (const img of images) {
      const { data } = await worker.recognize(img.buffer);
      const words: any[] = (data as any).words || [];
      for (const w of words) {
        const text = (w.text || '').trim();
        if (!text) continue;
        allTokens.push({
          text,
          x: w.bbox.x0,
          y: w.bbox.y0,
          width: w.bbox.x1 - w.bbox.x0,
          height: w.bbox.y1 - w.bbox.y0,
          page: img.page,
          confidence: w.confidence,
        });
      }
    }
    return allTokens;
  } finally {
    await worker.terminate();
  }
}
