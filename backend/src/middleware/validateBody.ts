import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware factory — validasi req.body dengan schema Zod.
 * Jika gagal, langsung 400 dengan pesan error yang jelas.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = (result.error as ZodError).errors[0];
      const field = first.path.join('.') || 'input';
      res.status(400).json({ error: `${field}: ${first.message}` });
      return;
    }
    req.body = result.data; // replace dengan data yang sudah di-sanitize
    next();
  };
}
