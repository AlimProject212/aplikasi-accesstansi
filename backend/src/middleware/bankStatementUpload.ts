import multer from 'multer';
import path from 'path';
import fs from 'fs';

/** Folder tempat file rekening koran & halaman hasil render disimpan sementara */
export const BANK_STATEMENT_UPLOAD_DIR = path.join(__dirname, '../../../uploads/bank-statements');

if (!fs.existsSync(BANK_STATEMENT_UPLOAD_DIR)) {
  fs.mkdirSync(BANK_STATEMENT_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANK_STATEMENT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIMES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan. Gunakan: PDF, JPG, PNG'));
  }
};

// Dipakai untuk endpoint /api/bank-statements/parse:
// - `file`: dokumen asli (arsip), 1 file
// - `pageImages`: halaman hasil render PNG dari PDF hasil scan (jalur OCR), bisa banyak
export const bankStatementUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file (gambar hasil render bisa lebih besar dari scan biasa)
    files: 31, // 1 file asli + maks 30 halaman
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'pageImages', maxCount: 30 },
]);
