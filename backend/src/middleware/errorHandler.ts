import { Request, Response, NextFunction } from 'express';

// Pesan yang aman ditampilkan ke user (business errors dari controller/service)
const SAFE_PREFIXES = [
  'Email', 'Password', 'Company', 'Tahun', 'Bulan', 'Akun', 'Kontak',
  'Jurnal', 'Anggaran', 'Tipe file', 'Tidak bisa', 'sudah', 'tidak ditemukan',
  'Terlalu banyak', 'tidak valid', 'tidak diizinkan', 'harus', 'wajib',
];

function isSafeMessage(msg: string): boolean {
  return SAFE_PREFIXES.some(p => msg.toLowerCase().includes(p.toLowerCase()));
}

export const errorHandler = (
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status ?? err.statusCode ?? 500;

  // Log lengkap hanya di server (tidak dikirim ke client)
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Kirim pesan yang aman ke client
  const clientMessage = status < 500 || isSafeMessage(err.message)
    ? err.message
    : 'Terjadi kesalahan pada server. Silakan coba lagi.';

  res.status(status).json({ error: clientMessage });
};
