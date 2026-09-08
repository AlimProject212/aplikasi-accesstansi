
import React, { useState, useEffect, useMemo } from 'react';
import { Product, StockAdjustment, InventorySettings, HierarchicalAccount, Warehouse } from '../../types';
import { Plus, X, Trash2, ClipboardList, Settings2, BookOpen, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { productsService } from '../../src/services/products.service';
import { warehousesService } from '../../src/services/warehouses.service';
import { stockAdjustmentsService, StockAdjustmentInput } from '../../src/services/stockAdjustments.service';
import { inventoryService, StockCardResponse, ValuationResponse, LowStockItem, GrossMarginResponse } from '../../src/services/inventory.service';
import { inventorySettingsService } from '../../src/services/inventorySettings.service';
import { accountsService } from '../../src/services/accounts.service';
import { useUI } from '../../src/context/UIContext';

type MainTab = 'stock-card' | 'adjustments' | 'reports' | 'settings';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const Inventory: React.FC = () => {
  const [mainTab, setMainTab] = useState<MainTab>('stock-card');

  const tabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: 'stock-card',  label: 'Kartu Stok',       icon: BookOpen },
    { id: 'adjustments', label: 'Penyesuaian Stok', icon: ClipboardList },
    { id: 'reports',     label: 'Laporan',          icon: TrendingUp },
    { id: 'settings',    label: 'Pengaturan Akun',  icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Kartu Stok &amp; Opname</h2>
        <p className="text-sm text-gray-500">Pantau mutasi stok dan lakukan penyesuaian (stok opname).</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mainTab === tab.id ? 'bg-white text-primary-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'stock-card' && <StockCardTab />}
      {mainTab === 'adjustments' && <AdjustmentsTab />}
      {mainTab === 'reports' && <ReportsTab />}
      {mainTab === 'settings' && <SettingsTab />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KARTU STOK
// ─────────────────────────────────────────────────────────────────────────────

const REF_LABEL: Record<string, string> = {
  OPENING: 'Saldo Awal', ADJUSTMENT: 'Penyesuaian', PURCHASE: 'Pembelian',
  SALE: 'Penjualan', POS: 'Kasir (POS)', TRANSFER: 'Transfer Gudang',
};

const StockCardTab: React.FC = () => {
  const { toast } = useUI();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [data, setData] = useState<StockCardResponse | null>(null);
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    productsService.getAll().then(setProducts).catch(console.error);
    inventoryService.getValuation().then(setValuation).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProductId) { setData(null); return; }
    setIsLoading(true);
    inventoryService.getStockCard(selectedProductId)
      .then(setData)
      .catch(err => toast(err.message || 'Gagal memuat kartu stok', 'error'))
      .finally(() => setIsLoading(false));
  }, [selectedProductId]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-2">Nilai Persediaan Total</h3>
        <p className="text-2xl font-bold text-primary-600">{formatCurrency(valuation?.totalValue || 0)}</p>
        <p className="text-xs text-gray-400 mt-1">Dihitung dari stok saat ini × harga pokok rata-rata setiap produk aktif.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Produk</label>
        <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}
          className="w-full md:w-96 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
          <option value="">- Pilih produk untuk lihat kartu stok -</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Memuat kartu stok...</div>
      ) : data ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span><span className="text-gray-400">Produk:</span> <strong>{data.product.name}</strong></span>
            <span><span className="text-gray-400">Stok saat ini:</span> <strong>{data.product.currentStock}</strong></span>
            <span><span className="text-gray-400">HPP Rata-rata:</span> <strong>{formatCurrency(data.product.avgCost)}</strong></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Tanggal</th>
                  <th className="px-4 py-2">Referensi</th>
                  <th className="px-4 py-2 text-right">Masuk</th>
                  <th className="px-4 py-2 text-right">Keluar</th>
                  <th className="px-4 py-2 text-right">Harga</th>
                  <th className="px-4 py-2 text-right">Saldo Qty</th>
                  <th className="px-4 py-2 text-right">Saldo Nilai</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Belum ada mutasi stok untuk produk ini.</td></tr>
                ) : data.entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-600">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-2 text-gray-600">{REF_LABEL[e.refType] || e.refType}</td>
                    <td className="px-4 py-2 text-right">
                      {e.qtyIn > 0 && <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><ArrowUpCircle className="w-3.5 h-3.5" /> {e.qtyIn}</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.qtyOut > 0 && <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><ArrowDownCircle className="w-3.5 h-3.5" /> {e.qtyOut}</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(e.unitCost)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">{e.balanceQty}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(e.balanceValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">Pilih produk di atas untuk melihat riwayat mutasi stoknya.</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PENYESUAIAN STOK
// ─────────────────────────────────────────────────────────────────────────────

interface AdjLineForm { productId: string; productName: string; systemQty: number; actualQty: number; }

const AdjustmentsTab: React.FC = () => {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<StockAdjustment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<AdjLineForm[]>([]);
  const [productPicker, setProductPicker] = useState('');

  const loadList = () => {
    setIsLoading(true);
    stockAdjustmentsService.getAll().then(setList).catch(err => toast(err.message, 'error')).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadList();
    productsService.getAll().then(setProducts).catch(console.error);
    warehousesService.getAll().then(setWarehouses).catch(console.error);
  }, []);

  const openCreateModal = () => {
    setWarehouseId(warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? '');
    setDate(new Date().toISOString().slice(0, 10));
    setReason('');
    setLines([]);
    setProductPicker('');
    setIsModalOpen(true);
  };

  const addLine = (productId: string) => {
    if (!productId || lines.some(l => l.productId === productId)) return;
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setLines(prev => [...prev, { productId: p.id, productName: `${p.sku} — ${p.name}`, systemQty: p.currentStock, actualQty: p.currentStock }]);
    setProductPicker('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) { toast('Tambahkan minimal 1 produk', 'warning'); return; }
    setIsSaving(true);
    try {
      const payload: StockAdjustmentInput = {
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        date, reason: reason || undefined,
        lines: lines.map(l => ({ productId: l.productId, actualQty: l.actualQty })),
      };
      await stockAdjustmentsService.create(payload);
      setIsModalOpen(false);
      loadList();
      toast('Penyesuaian stok berhasil dibuat (draft)', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuat penyesuaian stok', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async (adj: StockAdjustment) => {
    if (!await confirm(`Posting penyesuaian stok "${adj.adjustmentNumber}"? Stok akan langsung berubah dan jurnal otomatis dibuat.`, { title: 'Posting Penyesuaian Stok', confirmLabel: 'Ya, Posting' })) return;
    try {
      const posted = await stockAdjustmentsService.post(adj.id);
      setSelected(posted);
      loadList();
      toast('Penyesuaian stok berhasil diposting', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal posting', 'error');
    }
  };

  const handleDelete = async (adj: StockAdjustment) => {
    if (!await confirm(`Hapus draft "${adj.adjustmentNumber}"?`, { title: 'Hapus Draft', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await stockAdjustmentsService.delete(adj.id);
      if (selected?.id === adj.id) setSelected(null);
      loadList();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus', 'error');
    }
  };

  const openDetail = async (adj: StockAdjustment) => {
    try {
      const full = await stockAdjustmentsService.getById(adj.id);
      setSelected(full);
    } catch (err: any) {
      toast(err.message || 'Gagal memuat detail', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900">Daftar Penyesuaian Stok</h3>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm">
            <Plus className="w-4 h-4" /> Buat Penyesuaian
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-10 text-center text-gray-400">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-20" />
              Belum ada penyesuaian stok.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">No.</th>
                  <th className="px-4 py-2">Tanggal</th>
                  <th className="px-4 py-2">Gudang</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(adj => (
                  <tr key={adj.id} onClick={() => openDetail(adj)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selected?.id === adj.id ? 'bg-primary-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs">{adj.adjustmentNumber}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(adj.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-2 text-gray-600">{adj.warehouseName || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${adj.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {adj.status === 'POSTED' ? 'Posted' : 'Draft'}
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
                <h4 className="font-bold text-gray-900">{selected.adjustmentNumber}</h4>
                <p className="text-xs text-gray-400">{new Date(selected.date).toLocaleDateString('id-ID')} · {selected.warehouseName || '-'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${selected.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {selected.status === 'POSTED' ? 'Posted' : 'Draft'}
              </span>
            </div>
            {selected.reason && <p className="text-sm text-gray-600 mb-3">{selected.reason}</p>}
            <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
              {(selected.lines || []).map(l => (
                <div key={l.id} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-50">
                  <div>
                    <p className="font-medium text-gray-800">{l.productName}</p>
                    <p className="text-gray-400">Sistem: {l.systemQty} → Aktual: {l.actualQty}</p>
                  </div>
                  <span className={`font-bold ${l.difference > 0 ? 'text-emerald-600' : l.difference < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {l.difference > 0 ? '+' : ''}{l.difference}
                  </span>
                </div>
              ))}
            </div>
            {selected.status === 'DRAFT' ? (
              <div className="flex gap-2">
                <button onClick={() => handlePost(selected)} className="flex-1 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Posting
                </button>
                <button onClick={() => handleDelete(selected)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sudah diposting — stok & jurnal sudah tercatat, tidak bisa diubah lagi.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">Pilih salah satu penyesuaian di daftar untuk lihat detailnya.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Buat Penyesuaian Stok</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Gudang</label>
                  <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Pilih -</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Alasan</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: Stok opname bulanan Agustus 2026" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tambah Produk</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={productPicker} onChange={e => addLine(e.target.value)} className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Cari & pilih produk -</option>
                    {products.filter(p => !lines.some(l => l.productId === p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name} (stok: {p.currentStock})</option>
                    ))}
                  </select>
                </div>
              </div>

              {lines.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {lines.map((l, i) => {
                    const diff = l.actualQty - l.systemQty;
                    return (
                      <div key={l.productId} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{l.productName}</p>
                          <p className="text-xs text-gray-400">Stok sistem: {l.systemQty}</p>
                        </div>
                        <input type="number" value={l.actualQty}
                          onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, actualQty: Number(e.target.value) } : x))}
                          className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" />
                        <span className={`w-14 text-right text-sm font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                        <button type="button" onClick={() => setLines(prev => prev.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: LAPORAN
// ─────────────────────────────────────────────────────────────────────────────

const ReportsTab: React.FC = () => {
  const { toast } = useUI();
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [margin, setMargin] = useState<GrossMarginResponse | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(true);
  const [isLoadingMargin, setIsLoadingMargin] = useState(true);

  const loadLowStock = () => {
    setIsLoadingLowStock(true);
    inventoryService.getLowStock().then(setLowStock).catch(err => toast(err.message, 'error')).finally(() => setIsLoadingLowStock(false));
  };

  const loadMargin = () => {
    setIsLoadingMargin(true);
    inventoryService.getGrossMargin({ from: from || undefined, to: to || undefined })
      .then(setMargin).catch(err => toast(err.message, 'error')).finally(() => setIsLoadingMargin(false));
  };

  useEffect(() => { loadLowStock(); loadMargin(); }, []);

  return (
    <div className="space-y-6">
      {/* Stok Menipis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-amber-50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-900">Stok Menipis</h3>
          {lowStock.length > 0 && <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{lowStock.length} produk</span>}
        </div>
        {isLoadingLowStock ? (
          <div className="py-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : lowStock.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Semua stok masih di atas batas minimum. 👍</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">Produk</th>
                <th className="px-4 py-2">Kategori</th>
                <th className="px-4 py-2 text-right">Stok Saat Ini</th>
                <th className="px-4 py-2 text-right">Stok Minimum</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-4 py-2"><span className="font-medium text-gray-800">{item.name}</span> <span className="text-gray-400 text-xs">({item.sku})</span></td>
                  <td className="px-4 py-2 text-gray-500">{item.categoryName || '-'}</td>
                  <td className="px-4 py-2 text-right font-bold text-red-600">{item.currentStock}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{item.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Laba Kotor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-gray-900">Laba Kotor per Produk</h3>
          <span className="text-xs text-gray-400">(gabungan Faktur Penjualan + POS)</span>
          <div className="ml-auto flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500" />
            <span className="text-gray-300 text-xs">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500" />
            <button onClick={loadMargin} className="text-xs font-semibold bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-100">Filter</button>
          </div>
        </div>
        {isLoadingMargin ? (
          <div className="py-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : !margin || margin.items.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Belum ada penjualan pada periode ini.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-gray-400">Pendapatan</p>
                <p className="font-bold text-gray-900">{formatCurrency(margin.totals.revenue)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-gray-400">HPP</p>
                <p className="font-bold text-gray-900">{formatCurrency(margin.totals.cogs)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-gray-400">Laba Kotor</p>
                <p className="font-bold text-emerald-600">{formatCurrency(margin.totals.grossMargin)}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Produk</th>
                  <th className="px-4 py-2 text-right">Qty Terjual</th>
                  <th className="px-4 py-2 text-right">Pendapatan</th>
                  <th className="px-4 py-2 text-right">HPP</th>
                  <th className="px-4 py-2 text-right">Laba Kotor</th>
                  <th className="px-4 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {margin.items.map(item => (
                  <tr key={item.productId} className="border-b border-gray-50">
                    <td className="px-4 py-2"><span className="font-medium text-gray-800">{item.name}</span> <span className="text-gray-400 text-xs">({item.sku})</span></td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.qtySold}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(item.revenue)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(item.cogs)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600">{formatCurrency(item.grossMargin)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{item.marginPercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PENGATURAN AKUN
// ─────────────────────────────────────────────────────────────────────────────

const SettingsTab: React.FC = () => {
  const { toast } = useUI();
  const [settings, setSettings] = useState<InventorySettings | null>(null);
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [inventoryAccountId, setInventoryAccountId] = useState('');
  const [stockAdjustmentAccountId, setStockAdjustmentAccountId] = useState('');
  const [payableAccountId, setPayableAccountId] = useState('');
  const [receivableAccountId, setReceivableAccountId] = useState('');
  const [salesRevenueAccountId, setSalesRevenueAccountId] = useState('');
  const [cogsAccountId, setCogsAccountId] = useState('');
  const [salesTaxAccountId, setSalesTaxAccountId] = useState('');
  const [posCashAccountId, setPosCashAccountId] = useState('');
  const [posTransferAccountId, setPosTransferAccountId] = useState('');
  const [posQrisAccountId, setPosQrisAccountId] = useState('');
  const [posCardAccountId, setPosCardAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([inventorySettingsService.get(), accountsService.getAll()])
      .then(([s, accs]) => {
        setSettings(s);
        setAccounts(accs.filter(a => !a.isHeader));
        setInventoryAccountId(s.inventoryAccountId || '');
        setStockAdjustmentAccountId(s.stockAdjustmentAccountId || '');
        setPayableAccountId(s.payableAccountId || '');
        setReceivableAccountId(s.receivableAccountId || '');
        setSalesRevenueAccountId(s.salesRevenueAccountId || '');
        setCogsAccountId(s.cogsAccountId || '');
        setSalesTaxAccountId(s.salesTaxAccountId || '');
        setPosCashAccountId(s.posCashAccountId || '');
        setPosTransferAccountId(s.posTransferAccountId || '');
        setPosQrisAccountId(s.posQrisAccountId || '');
        setPosCardAccountId(s.posCardAccountId || '');
      })
      .catch(err => toast(err.message || 'Gagal memuat pengaturan', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await inventorySettingsService.update({
        inventoryAccountId: inventoryAccountId || null,
        stockAdjustmentAccountId: stockAdjustmentAccountId || null,
        payableAccountId: payableAccountId || null,
        receivableAccountId: receivableAccountId || null,
        salesRevenueAccountId: salesRevenueAccountId || null,
        cogsAccountId: cogsAccountId || null,
        salesTaxAccountId: salesTaxAccountId || null,
        posCashAccountId: posCashAccountId || null,
        posTransferAccountId: posTransferAccountId || null,
        posQrisAccountId: posQrisAccountId || null,
        posCardAccountId: posCardAccountId || null,
      });
      toast('Pengaturan akun persediaan berhasil disimpan', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan pengaturan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="py-12 text-center text-gray-400">Memuat pengaturan...</div>;

  const AccountPicker = ({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
        <option value="">- Pilih akun -</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">Akun Jurnal Otomatis</h3>
        <p className="text-xs text-gray-500 mb-4">Akun ini dipakai sistem untuk membuat jurnal otomatis saat transaksi persediaan/pembelian/penjualan diposting.</p>
      </div>
      <AccountPicker label="Akun Persediaan Barang Dagang" value={inventoryAccountId} onChange={setInventoryAccountId} />
      <AccountPicker label="Akun Selisih Stok" value={stockAdjustmentAccountId} onChange={setStockAdjustmentAccountId} hint="Dipakai saat memposting Penyesuaian Stok." />
      <AccountPicker label="Akun Hutang Usaha" value={payableAccountId} onChange={setPayableAccountId} hint="Dipakai saat memposting Penerimaan Barang (modul Pembelian)." />
      <AccountPicker label="Akun Piutang Usaha" value={receivableAccountId} onChange={setReceivableAccountId} hint="Dipakai saat memposting Faktur Penjualan." />
      <AccountPicker label="Akun Pendapatan Penjualan" value={salesRevenueAccountId} onChange={setSalesRevenueAccountId} />
      <AccountPicker label="Akun Harga Pokok Penjualan (HPP)" value={cogsAccountId} onChange={setCogsAccountId} />
      <AccountPicker label="Akun PPN Keluaran" value={salesTaxAccountId} onChange={setSalesTaxAccountId} hint="Hanya wajib diisi kalau Faktur Penjualan ada pajaknya." />

      <div className="pt-2 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-1 mt-4">Akun Pembayaran POS (Kasir)</h3>
        <p className="text-xs text-gray-500 mb-4">Menentukan akun Kas/Bank mana yang kena debit sesuai metode bayar yang dipilih kasir saat checkout.</p>
      </div>
      <AccountPicker label="Akun untuk Tunai" value={posCashAccountId} onChange={setPosCashAccountId} />
      <AccountPicker label="Akun untuk Transfer" value={posTransferAccountId} onChange={setPosTransferAccountId} />
      <AccountPicker label="Akun untuk QRIS" value={posQrisAccountId} onChange={setPosQrisAccountId} />
      <AccountPicker label="Akun untuk Kartu Debit/Kredit" value={posCardAccountId} onChange={setPosCardAccountId} />
      <div className="pt-2">
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  );
};
