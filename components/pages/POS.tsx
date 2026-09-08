
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Warehouse, Contact, POSShift, POSTransaction, POSPaymentMethod } from '../../types';
import { Search, Plus, Minus, Trash2, ShoppingCart, Wallet, CreditCard, QrCode, Landmark, Printer, X, History, Ban, LogOut } from 'lucide-react';
import { productsService } from '../../src/services/products.service';
import { warehousesService } from '../../src/services/warehouses.service';
import { contactsService } from '../../src/services/contacts.service';
import { posShiftsService } from '../../src/services/posShifts.service';
import { posService, POSCheckoutInput } from '../../src/services/pos.service';
import { useUI } from '../../src/context/UIContext';
import { useAuth } from '../../src/context/AuthContext';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

interface CartLine { productId: string; name: string; sku: string; unitPrice: number; qty: number; discount: number; stock: number; }

const PAYMENT_METHODS: { id: POSPaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'CASH', label: 'Tunai', icon: Wallet },
  { id: 'TRANSFER', label: 'Transfer', icon: Landmark },
  { id: 'QRIS', label: 'QRIS', icon: QrCode },
  { id: 'CARD', label: 'Kartu', icon: CreditCard },
];

export const POS: React.FC = () => {
  const { toast, confirm } = useUI();
  const { user } = useAuth();
  const canVoid = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR'].includes(user?.role || '');

  const [isLoading, setIsLoading] = useState(true);
  const [shift, setShift] = useState<POSShift | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);

  const [openWarehouseId, setOpenWarehouseId] = useState<number | ''>('');
  const [openingCash, setOpeningCash] = useState(0);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closingCash, setClosingCash] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<POSTransaction[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<POSTransaction | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadShift = () => {
    setIsLoading(true);
    posShiftsService.getCurrent()
      .then(setShift)
      .catch(err => toast(err.message || 'Gagal memuat shift', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadShift();
    productsService.getAll({ isActive: true }).then(setProducts).catch(console.error);
    warehousesService.getAll().then(setWarehouses).catch(console.error);
    contactsService.getAll().then((c: Contact[]) => setCustomers(c.filter(x => x.type === 'CUSTOMER' || x.type === 'BOTH'))).catch(console.error);
  }, []);

  useEffect(() => {
    if (shift && !openWarehouseId) setOpenWarehouseId(warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? '');
  }, [warehouses, shift]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, products]);

  const addToCart = (p: Product) => {
    if (p.currentStock <= 0) { toast(`Stok "${p.name}" habis`, 'warning'); return; }
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) {
        if (existing.qty + 1 > p.currentStock) { toast(`Stok "${p.name}" tidak cukup`, 'warning'); return prev; }
        return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.sellPrice, qty: 1, discount: 0, stock: p.currentStock }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredProducts.length > 0) {
      e.preventDefault();
      const exact = filteredProducts.find(p => p.barcode === search || p.sku.toLowerCase() === search.toLowerCase());
      addToCart(exact || filteredProducts[0]);
    }
  };

  const updateQty = (productId: string, qty: number) => {
    const line = cart.find(l => l.productId === productId);
    if (line && qty > line.stock) { toast(`Stok tidak cukup (tersedia ${line.stock})`, 'warning'); return; }
    setCart(prev => qty <= 0 ? prev.filter(l => l.productId !== productId) : prev.map(l => l.productId === productId ? { ...l, qty } : l));
  };

  const subtotal = cart.reduce((s, l) => s + (l.qty * l.unitPrice - l.discount), 0);
  const total = Math.max(0, subtotal - discount + tax);
  const change = Math.max(0, paidAmount - total);

  const resetCart = () => {
    setCart([]); setCustomerId(''); setDiscount(0); setTax(0); setPaymentMethod('CASH'); setPaidAmount(0);
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const opened = await posShiftsService.open(openWarehouseId ? Number(openWarehouseId) : undefined, openingCash);
      setShift(opened);
      toast('Shift dibuka', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuka shift', 'error');
    }
  };

  const openCloseModal = () => { setClosingCash(0); setIsCloseModalOpen(true); };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    try {
      const closed = await posShiftsService.close(shift.id, closingCash);
      setIsCloseModalOpen(false);
      toast(
        closed.difference === 0 ? 'Shift ditutup — kas pas.' :
        closed.difference! > 0 ? `Shift ditutup — kas lebih ${formatCurrency(closed.difference!)}` :
        `Shift ditutup — kas kurang ${formatCurrency(Math.abs(closed.difference!))}`,
        closed.difference === 0 ? 'success' : 'warning'
      );
      setShift(null);
      resetCart();
    } catch (err: any) {
      toast(err.message || 'Gagal menutup shift', 'error');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast('Keranjang masih kosong', 'warning'); return; }
    if (paidAmount < total) { toast('Jumlah bayar kurang', 'warning'); return; }
    setIsCheckingOut(true);
    try {
      const payload: POSCheckoutInput = {
        customerId: customerId || undefined, discount, tax, paymentMethod, paidAmount,
        lines: cart.map(l => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount })),
      };
      const tx = await posService.checkout(payload);
      setReceipt(tx);
      resetCart();
      productsService.getAll({ isActive: true }).then(setProducts).catch(console.error);
    } catch (err: any) {
      toast(err.message || 'Gagal memproses transaksi', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const openHistory = async () => {
    if (!shift) return;
    try {
      const list = await posService.getAll({ shiftId: shift.id });
      setShiftHistory(list);
      setIsHistoryOpen(true);
    } catch (err: any) {
      toast(err.message || 'Gagal memuat riwayat', 'error');
    }
  };

  const handleVoid = async (tx: POSTransaction) => {
    if (!await confirm(`Void transaksi "${tx.transactionNumber}"? Stok akan dikembalikan dan jurnal pembalik dibuat.`, { title: 'Void Transaksi', variant: 'danger', confirmLabel: 'Ya, Void' })) return;
    try {
      await posService.void(tx.id);
      toast('Transaksi berhasil di-void', 'success');
      openHistory();
    } catch (err: any) {
      toast(err.message || 'Gagal void transaksi', 'error');
    }
  };

  if (isLoading) return <div className="py-24 text-center text-gray-400">Memuat...</div>;

  // ── Belum ada shift terbuka ──────────────────────────────────────────────
  if (!shift) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-8">
        <div className="text-center mb-6">
          <ShoppingCart className="w-10 h-10 text-primary-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Buka Shift Kasir</h2>
          <p className="text-sm text-gray-500">Mulai sesi kasir dengan mencatat modal kas awal.</p>
        </div>
        <form onSubmit={handleOpenShift} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Gudang</label>
            <select value={openWarehouseId} onChange={e => setOpenWarehouseId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">- Pilih -</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Modal Kas Awal</label>
            <input type="number" min={0} value={openingCash} onChange={e => setOpeningCash(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg font-bold shadow-sm">
            Buka Shift
          </button>
        </form>
      </div>
    );
  }

  // ── Shift aktif — antarmuka kasir ────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
        <div className="text-sm">
          <span className="font-bold text-gray-900">Shift Aktif</span>
          <span className="text-gray-400 mx-2">·</span>
          <span className="text-gray-500">Dibuka {new Date(shift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-gray-400 mx-2">·</span>
          <span className="text-gray-500">Modal {formatCurrency(shift.openingCash)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={openHistory} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            <History className="w-4 h-4" /> Riwayat
          </button>
          <button onClick={openCloseModal} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Tutup Shift
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pencarian & keranjang */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef} autoFocus type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Cari / scan barcode produk..."
              className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
            {filteredProducts.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={p.currentStock <= 0}
                    className="w-full flex justify-between items-center px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-left">
                    <div>
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.sku} · Stok {p.currentStock}</p>
                    </div>
                    <span className="font-semibold text-gray-700">{formatCurrency(p.sellPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px]">
            {cart.length === 0 ? (
              <div className="py-20 text-center text-gray-300">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Keranjang masih kosong</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {cart.map(l => (
                    <tr key={l.productId} className="border-b border-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{l.name}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(l.unitPrice)} / unit</p>
                      </td>
                      <td className="px-2 py-3 w-32">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(l.productId, l.qty - 1)} className="p-1 text-gray-400 hover:text-gray-700"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="w-8 text-center font-semibold">{l.qty}</span>
                          <button onClick={() => updateQty(l.productId, l.qty + 1)} className="p-1 text-gray-400 hover:text-gray-700"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(l.qty * l.unitPrice - l.discount)}</td>
                      <td className="px-2 py-3">
                        <button onClick={() => updateQty(l.productId, 0)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Ringkasan & pembayaran */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-fit sticky top-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Customer (opsional)</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">- Walk-in -</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="text-sm space-y-1.5">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between items-center text-gray-500">
              <span>Diskon</span>
              <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-24 border border-gray-200 rounded px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div className="flex justify-between items-center text-gray-500">
              <span>Pajak</span>
              <input type="number" min={0} value={tax} onChange={e => setTax(Number(e.target.value))} className="w-24 border border-gray-200 rounded px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-100"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${paymentMethod === m.id ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Icon className="w-3.5 h-3.5" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Jumlah Bayar</label>
            <input type="number" min={0} value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold" />
            <div className="flex gap-1.5 mt-1.5">
              {[total, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).slice(0, 3).map(v => (
                <button key={v} onClick={() => setPaidAmount(v)} className="flex-1 text-xs py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">{formatCurrency(v)}</button>
              ))}
            </div>
          </div>

          {paidAmount > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-gray-500">Kembalian</span>
              <span className="font-bold text-gray-900">{formatCurrency(change)}</span>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={isCheckingOut || cart.length === 0 || paidAmount < total}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-bold shadow-sm disabled:opacity-50"
          >
            {isCheckingOut ? 'Memproses...' : `Bayar ${formatCurrency(total)}`}
          </button>
        </div>
      </div>

      {/* Modal tutup shift */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Tutup Shift</h3>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCloseShift} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Kas Aktual di Laci (hitung fisik)</label>
                <input required type="number" min={0} value={closingCash} onChange={e => setClosingCash(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCloseModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 shadow-sm">Tutup Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal riwayat transaksi shift */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Riwayat Transaksi Shift Ini</h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {shiftHistory.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Belum ada transaksi.</p>
              ) : shiftHistory.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tx.transactionNumber}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.transactionDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {tx.paymentMethod}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold text-sm ${tx.status === 'VOID' ? 'text-gray-300 line-through' : 'text-gray-800'}`}>{formatCurrency(tx.totalAmount)}</span>
                    {tx.status === 'COMPLETED' && canVoid && (
                      <button onClick={() => handleVoid(tx)} className="p-1.5 text-gray-300 hover:text-red-500" title="Void"><Ban className="w-4 h-4" /></button>
                    )}
                    {tx.status === 'VOID' && <span className="text-[10px] font-bold text-red-400">VOID</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Struk */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs overflow-hidden">
            <div id="pos-receipt" className="p-5 font-mono text-xs">
              <p className="text-center font-bold text-sm mb-1">STRUK PEMBAYARAN</p>
              <p className="text-center text-gray-500 mb-3">{receipt.transactionNumber}</p>
              <p className="mb-2">{new Date(receipt.transactionDate).toLocaleString('id-ID')}</p>
              <div className="border-t border-dashed border-gray-300 my-2" />
              {(receipt.lines || []).map(l => (
                <div key={l.id} className="flex justify-between mb-1">
                  <span>{l.productName} x{l.qty}</span>
                  <span>{formatCurrency(l.lineTotal)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(receipt.subtotal)}</span></div>
              {receipt.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatCurrency(receipt.discount)}</span></div>}
              {receipt.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatCurrency(receipt.tax)}</span></div>}
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(receipt.totalAmount)}</span></div>
              <div className="flex justify-between"><span>Bayar ({receipt.paymentMethod})</span><span>{formatCurrency(receipt.paidAmount)}</span></div>
              <div className="flex justify-between"><span>Kembali</span><span>{formatCurrency(receipt.changeAmount)}</span></div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              <p className="text-center text-gray-400">Terima kasih!</p>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-600 py-2 rounded-lg font-medium text-sm hover:bg-gray-50">
                <Printer className="w-4 h-4" /> Cetak
              </button>
              <button onClick={() => setReceipt(null)} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg font-bold text-sm">
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
