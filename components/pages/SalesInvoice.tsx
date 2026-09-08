
import React, { useState, useEffect } from 'react';
import { Contact, Product, Warehouse, SalesInvoice as SalesInvoiceType, SalesPayment, HierarchicalAccount } from '../../types';
import { Plus, X, Trash2, FileText, CheckCircle2, Search, Wallet } from 'lucide-react';
import { contactsService } from '../../src/services/contacts.service';
import { productsService } from '../../src/services/products.service';
import { warehousesService } from '../../src/services/warehouses.service';
import { accountsService } from '../../src/services/accounts.service';
import { salesInvoicesService, SalesInvoiceInput } from '../../src/services/salesInvoices.service';
import { salesPaymentsService } from '../../src/services/salesPayments.service';
import { useUI } from '../../src/context/UIContext';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

interface LineForm { productId: string; productName: string; qty: number; unitPrice: number; }

export const SalesInvoice: React.FC = () => {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<SalesInvoiceType[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashAccounts, setCashAccounts] = useState<HierarchicalAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SalesInvoiceType | null>(null);
  const [payments, setPayments] = useState<SalesPayment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineForm[]>([]);
  const [productPicker, setProductPicker] = useState('');

  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const loadList = () => {
    setIsLoading(true);
    salesInvoicesService.getAll().then(setList).catch(err => toast(err.message, 'error')).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadList();
    contactsService.getAll().then((c: Contact[]) => setCustomers(c.filter(v => v.type === 'CUSTOMER' || v.type === 'BOTH'))).catch(console.error);
    productsService.getAll().then(setProducts).catch(console.error);
    warehousesService.getAll().then(setWarehouses).catch(console.error);
    accountsService.getAll().then((a: HierarchicalAccount[]) => setCashAccounts(a.filter(x => !x.isHeader && x.type === 'ASSET'))).catch(console.error);
  }, []);

  const subtotal = lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0);
  const total = subtotal - discount + tax;

  const openCreateModal = () => {
    setCustomerId(''); setWarehouseId(warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? '');
    setInvoiceDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setDiscount(0); setTax(0); setNotes('');
    setLines([]); setProductPicker('');
    setIsModalOpen(true);
  };

  const addLine = (productId: string) => {
    if (!productId || lines.some(l => l.productId === productId)) return;
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setLines(prev => [...prev, { productId: p.id, productName: `${p.sku} — ${p.name}`, qty: 1, unitPrice: p.sellPrice }]);
    setProductPicker('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { toast('Pilih customer dulu', 'warning'); return; }
    if (lines.length === 0) { toast('Tambahkan minimal 1 produk', 'warning'); return; }
    setIsSaving(true);
    try {
      const payload: SalesInvoiceInput = {
        customerId, warehouseId: warehouseId ? Number(warehouseId) : undefined,
        invoiceDate, dueDate: dueDate || undefined, discount, tax, notes: notes || undefined,
        lines: lines.map(l => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
      };
      await salesInvoicesService.create(payload);
      setIsModalOpen(false);
      loadList();
      toast('Faktur penjualan berhasil dibuat (draft)', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuat faktur', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openDetail = async (inv: SalesInvoiceType) => {
    try {
      const full = await salesInvoicesService.getById(inv.id);
      setSelected(full);
      setPayments(full.status === 'POSTED' ? await salesPaymentsService.getAll(full.id) : []);
    } catch (err: any) {
      toast(err.message || 'Gagal memuat detail', 'error');
    }
  };

  const handlePost = async (inv: SalesInvoiceType) => {
    if (!await confirm(`Posting faktur "${inv.invoiceNumber}"? Stok akan berkurang dan jurnal piutang/pendapatan/HPP otomatis dibuat.`, { title: 'Posting Faktur Penjualan', confirmLabel: 'Ya, Posting' })) return;
    try {
      const posted = await salesInvoicesService.post(inv.id);
      setSelected(posted);
      loadList();
      toast('Faktur berhasil diposting', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal posting', 'error');
    }
  };

  const handleDelete = async (inv: SalesInvoiceType) => {
    if (!await confirm(`Hapus draft "${inv.invoiceNumber}"?`, { title: 'Hapus Draft', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await salesInvoicesService.delete(inv.id);
      if (selected?.id === inv.id) setSelected(null);
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
      await salesPaymentsService.create({ invoiceId: selected.id, paymentDate: payDate, amount: payAmount, accountId: payAccountId });
      setIsPayModalOpen(false);
      openDetail(selected);
      loadList();
      toast('Pelunasan berhasil dicatat', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mencatat pelunasan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Faktur Penjualan</h2>
        <p className="text-sm text-gray-500">Penjualan grosir/B2B dengan termin — piutang, pendapatan, dan HPP tercatat otomatis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">Daftar Faktur</h3>
            <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm">
              <Plus className="w-4 h-4" /> Buat Faktur
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="py-10 text-center text-gray-400">Memuat...</div>
            ) : list.length === 0 ? (
              <div className="py-10 text-center text-gray-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />Belum ada faktur penjualan.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2">No. Faktur</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Sisa Piutang</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(inv => (
                    <tr key={inv.id} onClick={() => openDetail(inv)}
                      className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selected?.id === inv.id ? 'bg-primary-50' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2 text-gray-700">{inv.customerName || '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatCurrency(inv.totalAmount - inv.paidAmount)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${inv.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : inv.status === 'VOID' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {inv.status === 'POSTED' ? 'Posted' : inv.status === 'VOID' ? 'Void' : 'Draft'}
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
                  <h4 className="font-bold text-gray-900">{selected.invoiceNumber}</h4>
                  <p className="text-xs text-gray-400">{selected.customerName} · {new Date(selected.invoiceDate).toLocaleDateString('id-ID')}</p>
                  {selected.dueDate && <p className="text-xs text-gray-400">Jatuh tempo: {new Date(selected.dueDate).toLocaleDateString('id-ID')}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${selected.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                  {selected.status === 'POSTED' ? 'Posted' : selected.status}
                </span>
              </div>
              <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                {(selected.lines || []).map(l => (
                  <div key={l.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                    <span className="text-gray-700">{l.productName} × {l.qty}</span>
                    <span className="text-gray-500">{formatCurrency(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm space-y-1 mb-4">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
                {selected.discount > 0 && <div className="flex justify-between text-gray-500"><span>Diskon</span><span>-{formatCurrency(selected.discount)}</span></div>}
                {selected.tax > 0 && <div className="flex justify-between text-gray-500"><span>Pajak</span><span>{formatCurrency(selected.tax)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span>{formatCurrency(selected.totalAmount)}</span></div>
              </div>

              {selected.status === 'DRAFT' ? (
                <div className="flex gap-2">
                  <button onClick={() => handlePost(selected)} className="flex-1 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Posting
                  </button>
                  <button onClick={() => handleDelete(selected)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              ) : selected.status === 'POSTED' ? (
                <>
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Sisa Piutang</p>
                      <p className="font-bold text-gray-900">{formatCurrency(selected.totalAmount - selected.paidAmount)}</p>
                    </div>
                    {selected.totalAmount - selected.paidAmount > 0 && (
                      <button onClick={openPayModal} className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs">
                        <Wallet className="w-3.5 h-3.5" /> Terima Bayar
                      </button>
                    )}
                  </div>
                  {payments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Riwayat Pelunasan</p>
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
              ) : (
                <p className="text-xs text-gray-400">Faktur ini sudah dibatalkan (void).</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">Pilih salah satu faktur di daftar untuk lihat detailnya.</div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Buat Faktur Penjualan</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                  <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">- Pilih -</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Faktur</label>
                  <input required type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jatuh Tempo</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Gudang</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')} className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">- Pilih -</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
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
                  {lines.map((l, i) => (
                    <div key={l.productId} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{l.productName}</p></div>
                      <input type="number" min={0.01} step="any" value={l.qty}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, qty: Number(e.target.value) } : x))}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Qty" />
                      <input type="number" min={0} value={l.unitPrice}
                        onChange={e => setLines(prev => prev.map((x, xi) => xi === i ? { ...x, unitPrice: Number(e.target.value) } : x))}
                        className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" placeholder="Harga" />
                      <button type="button" onClick={() => setLines(prev => prev.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Diskon (Rp)</label>
                  <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Pajak (Rp)</label>
                  <input type="number" min={0} value={tax} onChange={e => setTax(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-gray-500"><span>Diskon</span><span>-{formatCurrency(discount)}</span></div>}
                {tax > 0 && <div className="flex justify-between text-gray-500"><span>Pajak</span><span>{formatCurrency(tax)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>
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
              <h3 className="font-bold text-gray-900">Terima Pelunasan</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Bayar</label>
                <input required type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Terima ke Akun</label>
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
                <p className="text-xs text-gray-400 mt-1">Sisa piutang: {formatCurrency(selected.totalAmount - selected.paidAmount)}</p>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Terima Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
