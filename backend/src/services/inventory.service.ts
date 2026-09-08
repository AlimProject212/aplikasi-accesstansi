import { eq, and } from 'drizzle-orm';
import { db, products, stockLedger } from '../lib/prisma';

// Tipe transaksi Drizzle — dipakai supaya mutasi stok selalu ikut ke dalam
// db.transaction() yang sama dengan pembuatan jurnal (atomik).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface StockMoveParams {
  companyId: number;
  productId: string;
  warehouseId?: number | null;
  qty: number;
  date: Date;
  refType: 'OPENING' | 'ADJUSTMENT' | 'PURCHASE' | 'SALE' | 'POS' | 'TRANSFER';
  refId?: string | null;
  description?: string | null;
  createdById: number;
}

interface StockInParams extends StockMoveParams {
  unitCost: number;
}

interface StockMoveResult {
  newQty: number;
  unitCost: number;
}

/**
 * Catat stok MASUK — dipakai untuk pembelian, penyesuaian stok (selisih lebih),
 * dan input saldo awal. Meng-update avgCost pakai rata-rata bergerak (moving average):
 *   avgCost_baru = ((stokLama × avgCost_lama) + (qtyMasuk × unitCost)) / (stokLama + qtyMasuk)
 */
export async function recordStockIn(tx: Tx, params: StockInParams): Promise<StockMoveResult> {
  const { companyId, productId, warehouseId, qty, unitCost, date, refType, refId, description, createdById } = params;
  if (qty <= 0) throw new Error('Jumlah stok masuk harus lebih dari 0');

  const [product] = await tx.select().from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .for('update')
    .limit(1);
  if (!product) throw new Error('Produk tidak ditemukan');

  const newQty = product.currentStock + qty;
  const newAvgCost = newQty === 0 ? 0 : ((product.currentStock * product.avgCost) + (qty * unitCost)) / newQty;

  await tx.update(products)
    .set({ currentStock: newQty, avgCost: newAvgCost })
    .where(eq(products.id, productId));

  await tx.insert(stockLedger).values({
    id: crypto.randomUUID(),
    companyId,
    productId,
    warehouseId: warehouseId ?? null,
    date,
    refType,
    refId: refId ?? null,
    qtyIn: qty,
    qtyOut: 0,
    unitCost,
    balanceQty: newQty,
    balanceValue: newQty * newAvgCost,
    description: description ?? null,
    createdById,
  });

  return { newQty, unitCost: newAvgCost };
}

/**
 * Catat stok KELUAR — dipakai untuk penjualan (Faktur/POS) dan penyesuaian stok
 * (selisih kurang). unitCost yang dikembalikan = avgCost saat itu, dipakai
 * caller sebagai nilai HPP (COGS) baris jurnal.
 */
export async function recordStockOut(tx: Tx, params: StockMoveParams): Promise<StockMoveResult> {
  const { companyId, productId, warehouseId, qty, date, refType, refId, description, createdById } = params;
  if (qty <= 0) throw new Error('Jumlah stok keluar harus lebih dari 0');

  const [product] = await tx.select().from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .for('update')
    .limit(1);
  if (!product) throw new Error('Produk tidak ditemukan');
  if (product.currentStock < qty) {
    throw new Error(`Stok "${product.name}" tidak cukup (tersedia ${product.currentStock}, diminta ${qty})`);
  }

  const unitCost = product.avgCost;
  const newQty = product.currentStock - qty;

  await tx.update(products)
    .set({ currentStock: newQty })
    .where(eq(products.id, productId));

  await tx.insert(stockLedger).values({
    id: crypto.randomUUID(),
    companyId,
    productId,
    warehouseId: warehouseId ?? null,
    date,
    refType,
    refId: refId ?? null,
    qtyIn: 0,
    qtyOut: qty,
    unitCost,
    balanceQty: newQty,
    balanceValue: newQty * unitCost,
    description: description ?? null,
    createdById,
  });

  return { newQty, unitCost };
}
