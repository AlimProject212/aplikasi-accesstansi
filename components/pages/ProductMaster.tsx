
import React, { useState, useEffect } from 'react';
import { Product, ProductCategory, Unit, Warehouse } from '../../types';
import { Plus, Search, Edit2, Trash2, X, Package, Tag, Ruler, Warehouse as WarehouseIcon, AlertTriangle, Sparkles } from 'lucide-react';
import { productsService } from '../../src/services/products.service';
import { productCategoriesService } from '../../src/services/productCategories.service';
import { unitsService } from '../../src/services/units.service';
import { warehousesService } from '../../src/services/warehouses.service';
import { useUI } from '../../src/context/UIContext';
import { generateTradingDummyData } from '../../src/utils/generateTradingDummy';

type MainTab = 'products' | 'categories' | 'units' | 'warehouses';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const ProductMaster: React.FC = () => {
  const { toast, confirm } = useUI();
  const [mainTab, setMainTab] = useState<MainTab>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingDummy, setIsGeneratingDummy] = useState(false);
  const [dummyProgress, setDummyProgress] = useState('');

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [p, c, u, w] = await Promise.all([
        productsService.getAll(),
        productCategoriesService.getAll(),
        unitsService.getAll(),
        warehousesService.getAll(),
      ]);
      setProducts(p);
      setCategories(c);
      setUnits(u);
      setWarehouses(w);
    } catch (err: any) {
      toast(err.message || 'Gagal memuat data master barang', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleGenerateDummy = async () => {
    setIsGeneratingDummy(true);
    try {
      const result = await generateTradingDummyData(setDummyProgress);
      await loadAll();
      toast(
        `Dummy lengkap berhasil dibuat: ${result.productsCreated} produk, PO ${result.poNumber}, Penerimaan ${result.receiptNumber} (posted), Faktur ${result.invoiceNumber} (posted), ${result.posTransactions} transaksi POS.`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Gagal generate data dummy', 'error');
    } finally {
      setIsGeneratingDummy(false);
      setDummyProgress('');
    }
  };

  const tabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: 'products',   label: 'Barang',  icon: Package },
    { id: 'categories', label: 'Kategori', icon: Tag },
    { id: 'units',      label: 'Satuan',  icon: Ruler },
    { id: 'warehouses', label: 'Gudang',  icon: WarehouseIcon },
  ];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Persediaan &amp; Dagang</h2>
          <p className="text-sm text-gray-500">Kelola master barang, kategori, satuan, dan gudang.</p>
        </div>
        <button
          onClick={handleGenerateDummy}
          disabled={isGeneratingDummy}
          className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm disabled:opacity-60 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          {isGeneratingDummy ? (dummyProgress || 'Memproses...') : 'Generate Dummy Lengkap'}
        </button>
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

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Memuat data...</div>
      ) : mainTab === 'products' ? (
        <ProductsTab
          products={filteredProducts}
          categories={categories}
          units={units}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onChanged={loadAll}
        />
      ) : mainTab === 'categories' ? (
        <CategoriesTab categories={categories} onChanged={loadAll} />
      ) : mainTab === 'units' ? (
        <UnitsTab units={units} onChanged={loadAll} />
      ) : (
        <WarehousesTab warehouses={warehouses} onChanged={loadAll} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BARANG
// ─────────────────────────────────────────────────────────────────────────────

interface ProductsTabProps {
  products: Product[];
  categories: ProductCategory[];
  units: Unit[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onChanged: () => void;
}

const emptyProductForm = {
  sku: '', barcode: '', name: '', categoryId: undefined as number | undefined,
  unitId: undefined as number | undefined, purchasePrice: 0, sellPrice: 0, minStock: 0,
};

const ProductsTab: React.FC<ProductsTabProps> = ({ products, categories, units, searchQuery, setSearchQuery, onChanged }) => {
  const { toast, confirm } = useUI();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyProductForm);

  const openModal = (p?: Product) => {
    if (p) {
      setEditing(p);
      setForm({
        sku: p.sku, barcode: p.barcode || '', name: p.name,
        categoryId: p.categoryId ?? undefined, unitId: p.unitId ?? undefined,
        purchasePrice: p.purchasePrice, sellPrice: p.sellPrice, minStock: p.minStock,
      });
    } else {
      setEditing(null);
      setForm(emptyProductForm);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) { toast('SKU dan nama produk wajib diisi', 'warning'); return; }
    setIsSaving(true);
    try {
      if (editing) {
        await productsService.update(editing.id, form);
      } else {
        await productsService.create(form);
      }
      setIsModalOpen(false);
      onChanged();
      toast('Produk berhasil disimpan', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan produk', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!await confirm(`Yakin ingin menghapus produk "${p.name}"?`, { title: 'Hapus Produk', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await productsService.delete(p.id);
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus produk', 'error');
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, SKU, atau barcode..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-500" />
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold">
          <Plus className="w-4 h-4" /> Tambah Barang
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Harga Beli</th>
              <th className="px-4 py-3 text-right">Harga Jual</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                Belum ada data barang.
              </td></tr>
            ) : products.map(p => {
              const lowStock = p.currentStock <= p.minStock;
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.barcode && <div className="text-xs text-gray-400">{p.barcode}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.categoryName || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.sellPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 font-semibold ${lowStock ? 'text-red-600' : 'text-gray-700'}`}>
                      {lowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                      {p.currentStock} {p.unitAbbreviation || ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => openModal(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Barang' : 'Tambah Barang Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">SKU <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="BRG-001" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Barcode</label>
                  <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Opsional" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Barang <span className="text-red-500">*</span></label>
                <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Contoh: Kopi Bubuk 250gr" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori</label>
                  <select value={form.categoryId ?? ''} onChange={e => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : undefined })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">- Pilih -</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Satuan</label>
                  <select value={form.unitId ?? ''} onChange={e => setForm({ ...form, unitId: e.target.value ? Number(e.target.value) : undefined })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">- Pilih -</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Harga Beli</label>
                  <input type="number" min={0} value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Harga Jual</label>
                  <input type="number" min={0} value={form.sellPrice} onChange={e => setForm({ ...form, sellPrice: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Stok Min.</label>
                  <input type="number" min={0} value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {!editing && (
                <p className="text-xs text-gray-400">Stok awal barang baru dimulai dari 0 — penambahan stok dilakukan lewat modul Pembelian/Penyesuaian Stok.</p>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KATEGORI
// ─────────────────────────────────────────────────────────────────────────────

const CategoriesTab: React.FC<{ categories: ProductCategory[]; onChanged: () => void }> = ({ categories, onChanged }) => {
  const { toast, confirm } = useUI();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await productCategoriesService.create(name.trim());
      setName('');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menambah kategori', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      await productCategoriesService.update(id, editingName.trim());
      setEditingId(null);
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal mengubah kategori', 'error');
    }
  };

  const handleDelete = async (c: ProductCategory) => {
    if (!await confirm(`Yakin ingin menghapus kategori "${c.name}"?`, { title: 'Hapus Kategori', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await productCategoriesService.delete(c.id);
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus kategori', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nama kategori baru..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
        <button type="submit" disabled={isSaving} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </form>
      <div className="space-y-1">
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada kategori.</p>
        ) : categories.map(c => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
            {editingId === c.id ? (
              <input autoFocus type="text" value={editingName} onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate(c.id)}
                onBlur={() => handleUpdate(c.id)}
                className="flex-1 border border-primary-300 rounded px-2 py-1 text-sm outline-none" />
            ) : (
              <span className="text-sm text-gray-800">{c.name}</span>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingId(c.id); setEditingName(c.name); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SATUAN
// ─────────────────────────────────────────────────────────────────────────────

const UnitsTab: React.FC<{ units: Unit[]; onChanged: () => void }> = ({ units, onChanged }) => {
  const { toast, confirm } = useUI();
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !abbr.trim()) return;
    setIsSaving(true);
    try {
      await unitsService.create(name.trim(), abbr.trim());
      setName(''); setAbbr('');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menambah satuan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (u: Unit) => {
    if (!await confirm(`Yakin ingin menghapus satuan "${u.name}"?`, { title: 'Hapus Satuan', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await unitsService.delete(u.id);
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus satuan', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nama satuan (mis. Kotak)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
        <input type="text" value={abbr} onChange={e => setAbbr(e.target.value)} placeholder="Singkatan (mis. box)"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
        <button type="submit" disabled={isSaving} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </form>
      <div className="space-y-1">
        {units.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada satuan.</p>
        ) : units.map(u => (
          <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
            <span className="text-sm text-gray-800">{u.name} <span className="text-gray-400">({u.abbreviation})</span></span>
            <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GUDANG
// ─────────────────────────────────────────────────────────────────────────────

const WarehousesTab: React.FC<{ warehouses: Warehouse[]; onChanged: () => void }> = ({ warehouses, onChanged }) => {
  const { toast, confirm } = useUI();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await warehousesService.create(name.trim(), address.trim() || undefined);
      setName(''); setAddress('');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menambah gudang', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (w: Warehouse) => {
    if (!await confirm(`Yakin ingin menghapus gudang "${w.name}"?`, { title: 'Hapus Gudang', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await warehousesService.delete(w.id);
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus gudang', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
      <form onSubmit={handleAdd} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nama gudang..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          <button type="submit" disabled={isSaving} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
        <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Alamat (opsional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
      </form>
      <div className="space-y-1">
        {warehouses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada gudang.</p>
        ) : warehouses.map(w => (
          <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
            <div>
              <span className="text-sm text-gray-800 font-medium">{w.name}</span>
              {w.isDefault && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 border border-primary-100">DEFAULT</span>}
              {w.address && <p className="text-xs text-gray-400">{w.address}</p>}
            </div>
            {!w.isDefault && (
              <button onClick={() => handleDelete(w)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
