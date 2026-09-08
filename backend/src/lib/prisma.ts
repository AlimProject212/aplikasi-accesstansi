import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../db/schema';

// Pure JavaScript MySQL driver — no native Rust binary needed
// Solusi untuk shared hosting (Rumah Web) yang tidak support Prisma binary engine
export const pool = mysql.createPool(process.env.DATABASE_URL as string);

export const db = drizzle(pool, { schema, mode: 'default' });

// Re-export schema tables agar bisa diimport dari sini
export * from '../db/schema';
