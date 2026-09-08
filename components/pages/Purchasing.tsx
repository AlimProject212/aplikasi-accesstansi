
import React, { useState, useEffect } from 'react';
import { Contact, Product, Warehouse, PurchaseOrder, GoodsReceipt, PurchasePayment, POStatus } from '../../types';
import { Plus, X, Trash2, ShoppingCart, Truck, CheckCircle2, Ban, Search, Wallet } from 'lucide-react';
import { contactsService } from '../../src/services/contacts.service';
import { productsService } from '../../src/services/products.service';
import { warehousesService } from '../../src/services/warehouses.service';
import { accountsService } from '../../src/services/accounts.service';
import { purchaseOrdersService, PurchaseOrderInput } from '../../src/services/purchaseOrders.service';
import { goodsReceiptsService, GoodsReceiptInput } from '../../src/services/goodsReceipts.service';
import { purchasePaymentsService } from '../../src/services/purchasePayments.service';
import { useUI } from '../../src/context/UIContext';
import { HierarchicalAccount } from '../../types';

type MainTab = 'po' | 'receipts';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const PO_STATUS_LABEL: Record<POStatus, string> = {
  DRAFT: 'Draft', ORDERED: 'Dipesan', PARTIAL: 'Sebagian Diterima', RECEIVED: 'Selesai Diterima', CANCELLED: 'Dibatalkan',
};
const PO_STATUS_COLOR: Record<POStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-500 border-gray-200',
  ORDERED: 'bg-blue-50 text-blue-600 border-blue-100',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-100',
  RECEIVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  CANCELLED: 'bg-red-50 text-red-600 border-red-100',
};

export const Purchasing: React.FC = () => {
  const [mainTab, setMainTab] = useState<MainTab>('po');
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    contactsService.getAll().then((c: Contact[]) => setVendors(c.filter(v => v.type === 'VENDOR' || v.type === 'BOTH'))).catch(console.error);
    productsService.getAll().then(setProducts).catch(console.error);
    warehousesService.getAll().then(setWarehouses).catch(console.error);
  }, []);

  const tabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: 'po',       label: 'Purchase Order',        icon: ShoppingCart },
    { id: 'receipts', label: 'Penerimaan Barang & Hutang', icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pembelian</h2>
        <p className="text-sm text-gray-500">Kelola pesanan pembelian ke supplier dan penerimaan barangnya.</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mainTab === tab.id ? 'bg-white text-primary-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'po' ? (
        <POTab vendors={vendors} products={products} />
      ) : (
        <ReceiptsTab vendors={vendors} products={products} warehouses={warehouses} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PURCHASE ORDER
// ─────────────────────────────────────────────────────────────────────────────

interface POLineForm { productId: string; productName: string; qtyOrdered: number; unitPrice: number; }

const POTab: React.FC<{ vendors: Contact[]; products: Product[] }> = ({ vendors, products }) => {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<POLineForm[]>([]);
  const [productPicker, setProductPicker] = useState('');

  const loadList = () => {
    setIsLoading(true);
    purchaseOrdersService.getAll().then(setList).catch(err => toast(err.message, 'error')).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadList(); }, []);

  const openCreateModal = () => {
    setVendorId(''); setOrderDate(new Date().toISOString().slice(0, 10)); setExpectedDate(''); setNotes('');
    setLines([]); setProductPicker('');
    setIsModalOpen(true);
  };

  const addLine = (productId: string) => {
    if (!productId || lines.some(l => l.productId === productId)) return;
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setLines(prev => [...prev, { productId: p.id, productName: `${p.sku} — ${p.name}`, qtyOrdered: 1, unitPrice: p.purchasePrice }]);
    setProductPicker('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast('Pilih vendor dulu', 'warning'); return; }
    if (lines.length === 0) { toast('Tambahkan minimal 1 produk', 'warning'); return; }
    setIsSaving(true);
    try {
      const payload: PurchaseOrderInput = {
        vendorId, orderDate, expectedDate: expectedDate || undefined, notes: notes || undefined,
        lines: lines.map(l => ({ productId: l.productId, qtyOrdered: l.qtyOrdered, unitPrice: l.unitPrice })),
      };
      await purchaseOrdersService.create(payload);
      setIsModalOpen(false);
      loadList();
      toast('Purchase Order berhasil dibuat', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuat PO', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openDetail = async (po: PurchaseOrder) => {
    try { setSelected(await purchaseOrdersService.getById(po.id)); }
    catch (err: any) { toast(err.message || 'Gagal memuat detail', 'error'); }
  };

  const handleStatus = async (po: PurchaseOrder, status: POStatus) => {
    const label = status === 'ORDERED' ? 'kirim PO ke vendor' : 'batalkan PO';
    if (!await confirm(`Yakin ingin ${label} "${po.poNumber}"?`, { title: 'Konfirmasi', confirmLabel: 'Ya, Lanjutkan' })) return;
    try {
      const updated = await purchaseOrdersService.updateStatus(po.id, status);
      setSelected(updated);
      loadList();
    } catch (err: any) {
      toast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (po: PurchaseOrder) => {
    if (!await confirm(`Hapus draft "${po.poNumber}"?`, { title: 'Hapus Draft', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await purchaseOrdersService.delete(po.id);
      if (selected?.id === po.id) setSelected(null);
      loadList();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900">Daftar Purchase Order</h3>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm">
            <Plus className="w-4 h-4" /> Buat PO
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-10 text-center text-gray-400">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />Belum ada Purchase Order.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">No. PO</th>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Tanggal</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(po => (
                  <tr key={po.id} onClick={() => openDetail(po)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selected?.id === po.id ? 'bg-primary-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs">{po.poNumber}</td>
                    <td className="px-4 py-2 text-gray-700">{po.vendorName || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(po.orderDate).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PO_STATUS_COLOR[po.status]}`}>{PO_STATUS_LABEL[po.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        {selected ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-gray-900">{selected.poNumber}</h4>
                <p className="text-xs text-gray-400">{selected.vendorName} · {new Date(selected.orderDate).toLocaleDateString('id-ID')}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PO_STATUS_COLOR[selected.status]}`}>{PO_STATUS_LABEL[selected.status]}</span>
            </div>
            {selected.notes && <p className="text-sm text-gray-600 mb-3">{selected.notes}</p>}
            <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
              {(selected.lines || []).map(l => (
                <div key={l.id} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-50">
                  <div>
                    <p className="font-medium text-gray-800">{l.productName}</p>
                    <p className="text-gray-400">Diterima {l.qtyReceived} / {l.qtyOrdered} · {formatCurrency(l.unitPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'DRAFT' && (
                <>
                  <button onClick={() => handleStatus(selected, 'ORDERED')} className="flex-1 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Kirim ke Vendor
                  </button>
                  <button onClick={() => handleDelete(selected)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
              {(selected.status === 'ORDERED' || selected.status === 'PARTIAL') && (
                <button onClick={() => handleStatus(selected, 'CANCELLED')} className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg font-semibold text-sm border border-red-100">
                  <Ban className="w-4 h-4" /> Batalkan PO
                </button>
              )}
              {selected.status === 'RECEIVED' && <p className="text-xs text-gray-400">Semua barang sudah diterima.</p>}
              {selected.status === 'CANCELLED' && <p className="text-xs text-gray-400">PO ini sudah dibatalkan.</p>}
            </div>
            {(selected.status === 'ORDERED' || selected.status === 'PARTIAL') && (
              <p className="text-xs text-gray-400 mt-3">Buat Penerimaan Barang dari tab sebelah, lalu pilih PO ini untuk mengisi otomatis sisa barang yang belum diterima.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">Pilih salah satu PO di daftar untuk lihat detailnya.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Buat Purchase Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                  <select required value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Pilih -</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Pesan</label>
                  <input required type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Estimasi Tiba</label>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tambah Produk</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={productPicker} onChange={e => addLine(e.target.value)} className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Cari & pilih produk -</option>
                    {products.filter(p => !lines.some(l => l.productId === p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {lines.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {lines.map((l, i) => (
                    <div key={l.productId} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{l.productName}</p></div>
                      <input type="number" min={1} value={l.qtyOrdered}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, qtyOrdered: Number(e.target.value) } : x))}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Qty" />
                      <input type="number" min={0} value={l.unitPrice}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, unitPrice: Number(e.target.value) } : x))}
                        className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Harga" />
                      <button type="button" onClick={() => setLines(prev => prev.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Simpan PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PENERIMAAN BARANG & HUTANG
// ─────────────────────────────────────────────────────────────────────────────

interface GRLineForm { productId: string; productName: string; qty: number; unitCost: number; }

const ReceiptsTab: React.FC<{ vendors: Contact[]; products: Product[]; warehouses: Warehouse[] }> = ({ vendors, products, warehouses }) => {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<GoodsReceipt | null>(null);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [cashAccounts, setCashAccounts] = useState<HierarchicalAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [poId, setPoId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GRLineForm[]>([]);
  const [productPicker, setProductPicker] = useState('');

  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const loadList = () => {
    setIsLoading(true);
    goodsReceiptsService.getAll().then(setList).catch(err => toast(err.message, 'error')).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadList();
    accountsService.getAll().then((a: HierarchicalAccount[]) => setCashAccounts(a.filter(x => !x.isHeader && x.type === 'ASSET'))).catch(console.error);
  }, []);

  const openCreateModal = async () => {
    setPoId(''); setVendorId(''); setWarehouseId(warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? '');
    setReceiptDate(new Date().toISOString().slice(0, 10)); setNotes(''); setLines([]); setProductPicker('');
    try {
      const pos = await purchaseOrdersService.getAll();
      setOpenPOs(pos.filter(p => p.status === 'ORDERED' || p.status === 'PARTIAL'));
    } catch { /* opsional, non-blocking */ }
    setIsModalOpen(true);
  };

  const handlePickPO = async (id: string) => {
    setPoId(id);
    if (!id) { setLines([]); return; }
    try {
      const po = await purchaseOrdersService.getById(id);
      setVendorId(po.vendorId);
      const remainingLines = (po.lines || [])
        .filter(l => l.qtyOrdered - l.qtyReceived > 0)
        .map(l => ({ productId: l.productId, productName: `${l.productSku} — ${l.productName}`, qty: l.qtyOrdered - l.qtyReceived, unitCost: l.unitPrice }));
      setLines(remainingLines);
    } catch (err: any) {
      toast(err.message || 'Gagal memuat PO', 'error');
    }
  };

  const addLine = (productId: string) => {
    if (!productId || lines.some(l => l.productId === productId)) return;
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setLines(prev => [...prev, { productId: p.id, productName: `${p.sku} — ${p.name}`, qty: 1, unitCost: p.purchasePrice }]);
    setProductPicker('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast('Pilih vendor dulu', 'warning'); return; }
    if (lines.length === 0) { toast('Tambahkan minimal 1 produk', 'warning'); return; }
    setIsSaving(true);
    try {
      const payload: GoodsReceiptInput = {
        poId: poId || undefined, vendorId, warehouseId: warehouseId ? Number(warehouseId) : undefined,
        receiptDate, notes: notes || undefined,
        lines: lines.map(l => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
      };
      await goodsReceiptsService.create(payload);
      setIsModalOpen(false);
      loadList();
      toast('Penerimaan barang berhasil dibuat (draft)', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuat penerimaan barang', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openDetail = async (gr: GoodsReceipt) => {
    try {
      const full = await goodsReceiptsService.getById(gr.id);
      setSelected(full);
      if (full.status === 'POSTED') {
        setPayments(await purchasePaymentsService.getAll(full.id));
      } else {
        setPayments([]);
      }
    } catch (err: any) {
      toast(err.message || 'Gagal memuat detail', 'error');
    }
  };

  const handlePost = async (gr: GoodsReceipt) => {
    if (!await confirm(`Posting penerimaan "${gr.receiptNumber}"? Stok akan bertambah dan jurnal hutang otomatis dibuat.`, { title: 'Posting Penerimaan Barang', confirmLabel: 'Ya, Posting' })) return;
    try {
      const posted = await goodsReceiptsService.post(gr.id);
      setSelected(posted);
      loadList();
      toast('Penerimaan barang berhasil diposting', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal posting', 'error');
    }
  };

  const handleDelete = async (gr: GoodsReceipt) => {
    if (!await confirm(`Hapus draft "${gr.receiptNumber}"?`, { title: 'Hapus Draft', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await goodsReceiptsService.delete(gr.id);
      if (selected?.id === gr.id) setSelected(null);
      loadList();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus', 'error');
    }
  };

  const openPayModal = () => {
    if (!selected) return;
    setPayAmount(Math.max(0, selected.totalAmount - selected.paidAmount));
    setPayAccountId('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setIsPayModalOpen(true);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!payAccountId || payAmount <= 0) { toast('Isi akun kas/bank dan jumlah bayar', 'warning'); return; }
    setIsSaving(true);
    try {
      await purchasePaymentsService.create({ receiptId: selected.id, paymentDate: payDate, amount: payAmount, accountId: payAccountId });
      setIsPayModalOpen(false);
      openDetail(selected);
      loadList();
      toast('Pembayaran berhasil dicatat', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mencatat pembayaran', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900">Daftar Penerimaan Barang</h3>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm">
            <Plus className="w-4 h-4" /> Buat Penerimaan
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-10 text-center text-gray-400">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><Truck className="w-10 h-10 mx-auto mb-2 opacity-20" />Belum ada penerimaan barang.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">No.</th>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Sisa Hutang</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(gr => (
                  <tr key={gr.id} onClick={() => openDetail(gr)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selected?.id === gr.id ? 'bg-primary-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs">{gr.receiptNumber}</td>
                    <td className="px-4 py-2 text-gray-700">{gr.vendorName}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(gr.totalAmount)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatCurrency(gr.totalAmount - gr.paidAmount)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${gr.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {gr.status === 'POSTED' ? 'Posted' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        {selected ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-gray-900">{selected.receiptNumber}</h4>
                <p className="text-xs text-gray-400">{selected.vendorName} · {new Date(selected.receiptDate).toLocaleDateString('id-ID')}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${selected.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {selected.status === 'POSTED' ? 'Posted' : 'Draft'}
              </span>
            </div>
            <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
              {(selected.lines || []).map(l => (
                <div key={l.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-700">{l.productName} × {l.qty}</span>
                  <span className="text-gray-500">{formatCurrency(l.qty * l.unitCost)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-semibold mb-4">
              <span className="text-gray-500">Total</span>
              <span className="text-gray-900">{formatCurrency(selected.totalAmount)}</span>
            </div>

            {selected.status === 'DRAFT' ? (
              <div className="flex gap-2">
                <button onClick={() => handlePost(selected)} className="flex-1 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Posting
                </button>
                <button onClick={() => handleDelete(selected)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Sisa Hutang</p>
                    <p className="font-bold text-gray-900">{formatCurrency(selected.totalAmount - selected.paidAmount)}</p>
                  </div>
                  {selected.totalAmount - selected.paidAmount > 0 && (
                    <button onClick={openPayModal} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs">
                      <Wallet className="w-3.5 h-3.5" /> Bayar
                    </button>
                  )}
                </div>
                {payments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Riwayat Pembayaran</p>
                    <div className="space-y-1">
                      {payments.map(p => (
                        <div key={p.id} className="flex justify-between text-xs text-gray-600">
                          <span>{new Date(p.paymentDate).toLocaleDateString('id-ID')} · {p.accountName}</span>
                          <span className="font-semibold">{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">Pilih salah satu penerimaan barang di daftar untuk lihat detailnya.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Buat Penerimaan Barang</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Dari Purchase Order (opsional)</label>
                <select value={poId} onChange={e => handlePickPO(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">- Tanpa PO (input manual) -</option>
                  {openPOs.map(po => <option key={po.id} value={po.id}>{po.poNumber} — {po.vendorName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                  <select required value={vendorId} onChange={e => setVendorId(e.target.value)} disabled={!!poId} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-100">
                    <option value="">- Pilih -</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Gudang</label>
                  <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Pilih -</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Terima</label>
                  <input required type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>

              {!poId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tambah Produk</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select value={productPicker} onChange={e => addLine(e.target.value)} className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                      <option value="">- Cari & pilih produk -</option>
                      {products.filter(p => !lines.some(l => l.productId === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {lines.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {lines.map((l, i) => (
                    <div key={l.productId} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{l.productName}</p></div>
                      <input type="number" min={0.01} step="any" value={l.qty}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, qty: Number(e.target.value) } : x))}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Qty" />
                      <input type="number" min={0} value={l.unitCost}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, unitCost: Number(e.target.value) } : x))}
                        className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Harga" />
                      {!poId && (
                        <button type="button" onClick={() => setLines(prev => prev.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPayModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Bayar Hutang</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Bayar</label>
                <input required type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bayar dari Akun</label>
                <select required value={payAccountId} onChange={e => setPayAccountId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">- Pilih akun Kas/Bank -</option>
                  {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Jumlah Bayar</label>
                <input required type="number" min={1} max={selected.totalAmount - selected.paidAmount} value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Sisa hutang: {formatCurrency(selected.totalAmount - selected.paidAmount)}</p>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
