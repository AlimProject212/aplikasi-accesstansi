import { productCategoriesService } from '../services/productCategories.service';
import { unitsService } from '../services/units.service';
import { warehousesService } from '../services/warehouses.service';
import { productsService } from '../services/products.service';
import { contactsService } from '../services/contacts.service';
import { accountsService } from '../services/accounts.service';
import { inventorySettingsService } from '../services/inventorySettings.service';
import { purchaseOrdersService } from '../services/purchaseOrders.service';
import { goodsReceiptsService } from '../services/goodsReceipts.service';
import { purchasePaymentsService } from '../services/purchasePayments.service';
import { salesInvoicesService } from '../services/salesInvoices.service';
import { salesPaymentsService } from '../services/salesPayments.service';
import { posShiftsService } from '../services/posShifts.service';
import { posService } from '../services/pos.service';

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

interface ProductDef {
  sku: string; name: string; category: string; unit: string;
  buy: number; sell: number; min: number;
}

const CATEGORY_DEFS = ['Sembako', 'Elektronik', 'Alat Tulis Kantor'];

const PRODUCT_DEFS: ProductDef[] = [
  { sku: 'SMB-001', name: 'Beras Premium 5kg',        category: 'Sembako',            unit: 'pcs', buy: 62000, sell: 68000,  min: 10 },
  { sku: 'SMB-002', name: 'Minyak Goreng 2L',          category: 'Sembako',            unit: 'pcs', buy: 32000, sell: 36000,  min: 15 },
  { sku: 'SMB-003', name: 'Gula Pasir 1kg',            category: 'Sembako',            unit: 'pcs', buy: 14000, sell: 16000,  min: 20 },
  { sku: 'SMB-004', name: 'Kopi Bubuk 250gr',          category: 'Sembako',            unit: 'pcs', buy: 18000, sell: 22000,  min: 15 },
  { sku: 'SMB-005', name: 'Mie Instan (1 Dus isi 40)', category: 'Sembako',            unit: 'dus', buy: 95000, sell: 110000, min: 5 },
  { sku: 'ELK-001', name: 'Kabel USB Type-C',          category: 'Elektronik',         unit: 'pcs', buy: 15000, sell: 25000,  min: 20 },
  { sku: 'ELK-002', name: 'Power Bank 10000mAh',       category: 'Elektronik',         unit: 'pcs', buy: 85000, sell: 120000, min: 8 },
  { sku: 'ELK-003', name: 'Earphone Bluetooth',        category: 'Elektronik',         unit: 'pcs', buy: 65000, sell: 95000,  min: 10 },
  { sku: 'ELK-004', name: 'Charger Fast Charging',     category: 'Elektronik',         unit: 'pcs', buy: 35000, sell: 55000,  min: 15 },
  { sku: 'ATK-001', name: 'Buku Tulis 38 Lembar',      category: 'Alat Tulis Kantor',  unit: 'pcs', buy: 2500,  sell: 4000,   min: 50 },
  { sku: 'ATK-002', name: 'Pulpen Standar (1 Lusin)',  category: 'Alat Tulis Kantor',  unit: 'lsn', buy: 12000, sell: 18000,  min: 10 },
  { sku: 'ATK-003', name: 'Map Plastik',               category: 'Alat Tulis Kantor',  unit: 'pcs', buy: 1500,  sell: 3000,   min: 30 },
];

export interface DummyProgress { step: string }

export interface DummyResult {
  productsCreated: number;
  poNumber: string;
  receiptNumber: string;
  invoiceNumber: string;
  posTransactions: number;
}

export async function generateTradingDummyData(onProgress: (step: string) => void): Promise<DummyResult> {
  onProgress('Mengecek pengaturan akun...');
  const settings = await inventorySettingsService.get();
  const requiredKeys: (keyof typeof settings)[] = ['inventoryAccountId', 'payableAccountId', 'receivableAccountId', 'salesRevenueAccountId', 'cogsAccountId'];
  const missing = requiredKeys.filter(k => !settings[k]);
  if (missing.length > 0) {
    throw new Error('Atur dulu Akun Persediaan, Hutang Usaha, Piutang Usaha, Pendapatan Penjualan & HPP di tab "Pengaturan Akun" (menu Kartu Stok & Opname) sebelum generate data dummy.');
  }

  onProgress('Membuat kategori barang...');
  for (const name of CATEGORY_DEFS) {
    await productCategoriesService.create(name).catch(() => {});
  }
  const categories = await productCategoriesService.getAll();
  const catId = (name: string) => categories.find(c => c.name === name)?.id;

  const units = await unitsService.getAll();
  const unitId = (abbr: string) => units.find(u => u.abbreviation === abbr)?.id;

  const warehouses = await warehousesService.getAll();
  const warehouseId = warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id;

  onProgress('Membuat produk...');
  for (const p of PRODUCT_DEFS) {
    await productsService.create({
      sku: p.sku, name: p.name, categoryId: catId(p.category), unitId: unitId(p.unit),
      purchasePrice: p.buy, sellPrice: p.sell, minStock: p.min,
    }).catch(() => {});
  }
  const allProducts = await productsService.getAll();
  const productBySku = (sku: string) => allProducts.find(p => p.sku === sku);

  onProgress('Membuat kontak vendor & customer...');
  const existingContacts = await contactsService.getAll();
  let vendor = existingContacts.find(c => c.name === 'CV Sumber Grosir');
  if (!vendor) vendor = await contactsService.create({ name: 'CV Sumber Grosir', type: 'VENDOR', phone: '021-5551234', address: 'Jl. Industri Raya No. 12, Jakarta' });
  let customer = existingContacts.find(c => c.name === 'Toko Berkah Jaya');
  if (!customer) customer = await contactsService.create({ name: 'Toko Berkah Jaya', type: 'CUSTOMER', phone: '0812-3456-7890', address: 'Jl. Pasar Baru No. 5, Bandung' });

  const accounts = await accountsService.getAll();
  const cashAccount = accounts.find(a => !a.isHeader && a.type === 'ASSET');

  onProgress('Membuat Purchase Order & Penerimaan Barang...');
  const poLines = PRODUCT_DEFS
    .map(p => ({ def: p, product: productBySku(p.sku) }))
    .filter(x => x.product)
    .map(x => ({ productId: x.product!.id, qtyOrdered: 50, unitPrice: x.def.buy }));

  const po = await purchaseOrdersService.create({ vendorId: vendor.id, orderDate: today(), lines: poLines });
  await purchaseOrdersService.updateStatus(po.id, 'ORDERED');
  const receipt = await goodsReceiptsService.create({
    poId: po.id, vendorId: vendor.id, warehouseId, receiptDate: today(),
    lines: poLines.map(l => ({ productId: l.productId, qty: l.qtyOrdered, unitCost: l.unitPrice })),
  });
  await goodsReceiptsService.post(receipt.id);

  if (cashAccount) {
    onProgress('Mencatat pembayaran sebagian hutang...');
    const totalPO = poLines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0);
    await purchasePaymentsService.create({ receiptId: receipt.id, paymentDate: today(), amount: Math.round(totalPO * 0.5), accountId: cashAccount.id }).catch(() => {});
  }

  onProgress('Membuat Faktur Penjualan...');
  const salesDefs = PRODUCT_DEFS.slice(0, 6);
  const invLines = salesDefs
    .map(p => ({ def: p, product: productBySku(p.sku) }))
    .filter(x => x.product)
    .map(x => ({ productId: x.product!.id, qty: 5, unitPrice: x.def.sell }));

  const invoice = await salesInvoicesService.create({ customerId: customer.id, invoiceDate: today(), dueDate: daysFromNow(14), lines: invLines });
  await salesInvoicesService.post(invoice.id);

  if (cashAccount) {
    onProgress('Mencatat pelunasan sebagian piutang...');
    const totalInv = invLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    await salesPaymentsService.create({ invoiceId: invoice.id, paymentDate: today(), amount: Math.round(totalInv * 0.6), accountId: cashAccount.id }).catch(() => {});
  }

  onProgress('Simulasi transaksi kasir (POS)...');
  let posCount = 0;
  let shift = await posShiftsService.getCurrent();
  if (!shift) shift = await posShiftsService.open(warehouseId, 500000);

  const posDefs = PRODUCT_DEFS.slice(6);
  const paymentMethods: ('CASH' | 'QRIS' | 'TRANSFER')[] = ['CASH', 'QRIS', 'TRANSFER'];
  for (let i = 0; i < 3; i++) {
    const def = posDefs[i % posDefs.length];
    const product = productBySku(def.sku);
    if (!product) continue;
    const qty = 2;
    const totalAmount = qty * def.sell;
    await posService.checkout({
      paymentMethod: paymentMethods[i], paidAmount: totalAmount,
      lines: [{ productId: product.id, qty, unitPrice: def.sell }],
    }).catch(() => {});
    posCount++;
  }

  onProgress('Selesai!');

  return {
    productsCreated: PRODUCT_DEFS.length,
    poNumber: po.poNumber,
    receiptNumber: receipt.receiptNumber,
    invoiceNumber: invoice.invoiceNumber,
    posTransactions: posCount,
  };
}
