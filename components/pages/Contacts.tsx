
import React, { useState, useEffect } from 'react';
import { Contact } from '../../types';
import { Plus, Search, Edit2, Trash2, X, User, Phone, Mail, MapPin, Building, Database } from 'lucide-react';
import { contactsService } from '../../src/services/contacts.service';
import { useUI } from '../../src/context/UIContext';

export const Contacts: React.FC = () => {
  const { toast, confirm } = useUI();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Contact>>({
    name: '', type: 'CUSTOMER', email: '', phone: '', address: '', taxId: ''
  });

  // Load contacts from API
  useEffect(() => {
    contactsService.getAll()
      .then(setContacts)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleOpenModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData(contact);
    } else {
      setEditingContact(null);
      setFormData({ name: '', type: activeTab === 'ALL' ? 'CUSTOMER' : activeTab, email: '', phone: '', address: '', taxId: '' });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm("Yakin ingin menghapus kontak ini?", { title: 'Hapus Kontak', variant: 'danger', confirmLabel: 'Ya, Hapus' })) return;
    try {
      await contactsService.delete(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus kontak', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast("Nama wajib diisi", 'warning'); return; }
    setIsSaving(true);
    try {
      if (editingContact) {
        const updated = await contactsService.update(editingContact.id, formData);
        setContacts(prev => prev.map(c => c.id === editingContact.id ? updated : c));
      } else {
        const created = await contactsService.create({
          name: formData.name!,
          type: formData.type as 'CUSTOMER' | 'VENDOR' | 'BOTH',
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          taxId: formData.taxId,
        });
        setContacts(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan kontak', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDummy = async () => {
    const dummyData = [
      { name: "Toko Sejahtera", type: 'CUSTOMER' as const, email: "admin@sejahtera.com", phone: "081234567890", address: "Jl. Merdeka No. 45, Jakarta", taxId: "01.234.567.8-001.000" },
      { name: "Budi Santoso", type: 'CUSTOMER' as const, email: "budi.s@gmail.com", phone: "085678901234", address: "Komplek Permai Blok A3, Bandung", taxId: "" },
      { name: "CV Abadi Jaya", type: 'CUSTOMER' as const, email: "sales@abadijaya.co.id", phone: "021-5556677", address: "Ruko Glodok Plaza, Jakarta Barat", taxId: "02.345.678.9-002.000" },
      { name: "PT Telkom Indonesia", type: 'VENDOR' as const, email: "billing@telkom.co.id", phone: "147", address: "Graha Merah Putih, Jakarta", taxId: "01.000.000.1-000.000" },
      { name: "Supplier Kertas Maju", type: 'VENDOR' as const, email: "order@kertasmaju.com", phone: "081122334455", address: "Jl. Industri Raya No. 10, Tangerang", taxId: "03.456.789.0-003.000" },
      { name: "PT Sumber Rejeki", type: 'BOTH' as const, email: "info@sumberrejeki.com", phone: "031-889900", address: "Kawasan Industri Rungkut, Surabaya", taxId: "04.567.890.1-004.000" },
      { name: "Bengkel Motor Cepat", type: 'BOTH' as const, email: "service@motorcepat.com", phone: "089988776655", address: "Jl. Otista No. 88, Jakarta Timur", taxId: "" },
      { name: "Restoran Enak Sekali", type: 'BOTH' as const, email: "booking@enaklezat.id", phone: "021-77889900", address: "Jl. Senopati No. 100, Jakarta Selatan", taxId: "05.678.901.2-005.000" },
      { name: "Firma Hukum Adil", type: 'BOTH' as const, email: "contact@adillaw.com", phone: "021-33445566", address: "Gedung Bursa Efek, Jakarta", taxId: "06.789.012.3-006.000" },
      { name: "Toko Bangunan Kokoh", type: 'BOTH' as const, email: "sales@tbkokoh.com", phone: "081345678901", address: "Jl. Raya Bogor KM 30, Depok", taxId: "07.890.123.4-007.000" },
    ];
    try {
      const created = await Promise.all(dummyData.map(d => contactsService.create(d)));
      setContacts(prev => [...prev, ...created]);
      toast("Berhasil menambahkan 10 kontak dummy.", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal generate dummy', 'error');
    }
  };

  // Filter (client-side, sudah ada semua data dari API)
  const filteredContacts = contacts.filter(c => {
    const matchesTab = activeTab === 'ALL' || c.type === activeTab || c.type === 'BOTH';
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kontak (Mitra Bisnis)</h2>
          <p className="text-sm text-gray-500">Kelola data Pelanggan dan Vendor/Pemasok.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerateDummy} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold text-sm">
            <Database className="w-4 h-4" /> Generate Dummy
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-semibold">
            <Plus className="w-4 h-4" /> Tambah Kontak
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            {(['ALL', 'CUSTOMER', 'VENDOR'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab ? 'bg-white text-primary-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab === 'ALL' ? 'Semua' : tab === 'CUSTOMER' ? 'Pelanggan' : 'Vendor'}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama, email, telp..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Memuat kontak...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Belum ada data kontak.</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${contact.type === 'CUSTOMER' ? 'bg-blue-500' : contact.type === 'VENDOR' ? 'bg-orange-500' : 'bg-purple-500'}`}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{contact.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${contact.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-600 border-blue-100' : contact.type === 'VENDOR' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                        {contact.type === 'CUSTOMER' ? 'Pelanggan' : contact.type === 'VENDOR' ? 'Vendor' : 'Mitra'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(contact)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(contact.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600 mt-4">
                  {contact.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {contact.phone}</div>}
                  {contact.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {contact.email}</div>}
                  {contact.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> <span className="truncate">{contact.address}</span></div>}
                  {contact.taxId && <div className="flex items-center gap-2"><Building className="w-3.5 h-3.5 text-gray-400" /> NPWP: {contact.taxId}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">{editingContact ? 'Edit Kontak' : 'Tambah Kontak Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Contoh: PT Sumber Makmur" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tipe Kontak</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CUSTOMER', 'VENDOR', 'BOTH'] as const).map(type => (
                    <div key={type} onClick={() => setFormData({ ...formData, type })} className={`cursor-pointer border rounded-lg px-3 py-2 text-center text-sm font-medium transition-all ${formData.type === type ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {type === 'CUSTOMER' ? 'Pelanggan' : type === 'VENDOR' ? 'Vendor' : 'Keduanya'}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="email@contoh.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telepon</label>
                  <input type="text" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="0812..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat</label>
                <textarea rows={2} value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="Alamat lengkap..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">NPWP (Opsional)</label>
                <input type="text" value={formData.taxId || ''} onChange={e => setFormData({ ...formData, taxId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="00.000.000..." />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600 shadow-sm disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : 'Simpan Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
