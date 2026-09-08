
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  FolderArchive,
  Search,
  Filter,
  Download,
  Upload,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  History,
  Archive,
  Loader2,
  XCircle,
  Layers,
  Tag,
  Pencil,
  FolderPlus,
  Tags,
} from 'lucide-react';
import { periodsService } from '../../src/services/settings.service';
import { auditDocsService, AuditDoc } from '../../src/services/auditDocs.service';
import { docGroupsService, DocGroup, DocGroupDocument } from '../../src/services/docGroups.service';
import { docCategoriesService, DocCategory } from '../../src/services/docCategories.service';
import { useUI } from '../../src/context/UIContext';

type ReadinessStatus = AuditDoc['status'];

interface AuditLog {
  id: string;
  action: string;
  user: string;
  time: string;
}

const STATUS_STYLE: Record<ReadinessStatus, { bg: string; text: string; border: string }> = {
  GREEN:  { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  YELLOW: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  RED:    { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
};

export const RepositoryDokumen: React.FC = () => {
  const { toast, confirm } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ────────────────────────────────────────────────────────────────
  const [activeYear, setActiveYear]           = useState<string>('');
  const [years, setYears]                     = useState<string[]>([]);
  const [isLoadingYears, setIsLoadingYears]   = useState(true);
  const [documents, setDocuments]             = useState<AuditDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs]     = useState(false);
  const [isUploading, setIsUploading]         = useState(false);

  // Kategori dinamis
  const [categories, setCategories]           = useState<DocCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [expandedCategories, setExpandedCategories]   = useState<string[]>([]);

  // Modal buat/edit kategori
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory]         = useState<DocCategory | null>(null);
  const [categoryForm, setCategoryForm]               = useState({ label: '', description: '' });
  const [isSavingCategory, setIsSavingCategory]       = useState(false);

  const [searchQuery, setSearchQuery]       = useState('');
  const [filterStatus, setFilterStatus]     = useState<ReadinessStatus | 'ALL'>('ALL');

  // Upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDragging, setIsDragging]               = useState(false);
  const [selectedFile, setSelectedFile]           = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name:     '',
    category: 'LEGAL',
    status:   'GREEN' as ReadinessStatus,
  });

  // Audit trail
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [auditLogs, setAuditLogs]               = useState<AuditLog[]>([]);

  // View mode: kategori atau grup
  const [viewMode, setViewMode] = useState<'kategori' | 'grup'>('kategori');

  // Grup state
  const [groups, setGroups]                       = useState<DocGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups]     = useState(false);
  const [expandedGroups, setExpandedGroups]       = useState<number[]>([]);
  const [groupDocuments, setGroupDocuments]       = useState<Record<number, DocGroupDocument[]>>({});
  const [loadingGroupDocs, setLoadingGroupDocs]   = useState<Record<number, boolean>>({});

  // Modal buat/edit grup
  const [isGroupModalOpen, setIsGroupModalOpen]   = useState(false);
  const [editingGroup, setEditingGroup]           = useState<DocGroup | null>(null);
  const [groupForm, setGroupForm]                 = useState({ name: '', description: '' });
  const [isSavingGroup, setIsSavingGroup]         = useState(false);

  // Modal assign dokumen ke grup
  const [assignDoc, setAssignDoc]                 = useState<AuditDoc | null>(null);
  const [assignSelectedGroupIds, setAssignSelectedGroupIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning]             = useState(false);

  // ─── Load categories ─────────────────────────────────────────────────────
  const loadCategories = () => {
    setIsLoadingCategories(true);
    docCategoriesService.getAll()
      .then(cats => {
        setCategories(cats);
        setExpandedCategories(cats.map(c => c.categoryKey));
      })
      .catch(() => toast('Gagal memuat kategori dokumen.', 'error'))
      .finally(() => setIsLoadingCategories(false));
  };

  useEffect(() => { loadCategories(); }, []);

  // ─── Kategori CRUD ────────────────────────────────────────────────────────
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ label: '', description: '' });
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat: DocCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ label: cat.label, description: cat.description ?? '' });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.label.trim()) {
      toast('Nama kategori wajib diisi.', 'warning');
      return;
    }
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const updated = await docCategoriesService.update(editingCategory.id, categoryForm.label, categoryForm.description);
        setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast(`Kategori "${updated.label}" diperbarui.`, 'success');
      } else {
        const created = await docCategoriesService.create(categoryForm.label, categoryForm.description);
        setCategories(prev => [...prev, created]);
        setExpandedCategories(prev => [...prev, created.categoryKey]);
        toast(`Kategori "${created.label}" dibuat.`, 'success');
      }
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan kategori.', 'error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: DocCategory) => {
    const ok = await confirm(
      `Hapus kategori "${cat.label}"? Pastikan tidak ada dokumen yang menggunakan kategori ini.`,
      { title: 'Hapus Kategori', variant: 'danger', confirmLabel: 'Ya, Hapus' }
    );
    if (!ok) return;
    try {
      await docCategoriesService.delete(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      setExpandedCategories(prev => prev.filter(k => k !== cat.categoryKey));
      toast(`Kategori "${cat.label}" dihapus.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus kategori.', 'error');
    }
  };

  // ─── Load years from API ──────────────────────────────────────────────────
  useEffect(() => {
    periodsService.getAll()
      .then(periods => {
        const ys = periods.map(p => p.year).sort((a, b) => Number(b) - Number(a));
        setYears(ys);
        const active = periods.find(p => p.isActive);
        const yr = active?.year || ys[0] || new Date().getFullYear().toString();
        setActiveYear(yr);
      })
      .catch(() => {
        const yr = new Date().getFullYear().toString();
        setYears([yr]);
        setActiveYear(yr);
        toast('Gagal memuat data periode dari server.', 'warning');
      })
      .finally(() => setIsLoadingYears(false));
  }, []);

  // ─── Load documents when year changes ────────────────────────────────────
  useEffect(() => {
    if (!activeYear) return;
    setIsLoadingDocs(true);
    auditDocsService.getAll(activeYear)
      .then(setDocuments)
      .catch(() => toast('Gagal memuat dokumen dari server.', 'error'))
      .finally(() => setIsLoadingDocs(false));
  }, [activeYear]);

  // ─── Load audit logs from localStorage ───────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('accesstansi_audit_logs');
    if (saved) setAuditLogs(JSON.parse(saved));
  }, []);

  // ─── Load groups ─────────────────────────────────────────────────────────
  const loadGroups = () => {
    setIsLoadingGroups(true);
    docGroupsService.getAll()
      .then(setGroups)
      .catch(() => toast('Gagal memuat grup dokumen.', 'error'))
      .finally(() => setIsLoadingGroups(false));
  };

  useEffect(() => { loadGroups(); }, []);

  // ─── Load documents in group (lazy) ──────────────────────────────────────
  const loadGroupDocuments = (groupId: number) => {
    if (groupDocuments[groupId]) return;
    setLoadingGroupDocs(prev => ({ ...prev, [groupId]: true }));
    docGroupsService.getDocuments(groupId)
      .then(docs => setGroupDocuments(prev => ({ ...prev, [groupId]: docs })))
      .catch(() => toast('Gagal memuat dokumen grup.', 'error'))
      .finally(() => setLoadingGroupDocs(prev => ({ ...prev, [groupId]: false })));
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      if (prev.includes(groupId)) return prev.filter(id => id !== groupId);
      loadGroupDocuments(groupId);
      return [...prev, groupId];
    });
  };

  // ─── Grup CRUD ────────────────────────────────────────────────────────────
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '' });
    setIsGroupModalOpen(true);
  };

  const openEditGroup = (g: DocGroup) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, description: g.description ?? '' });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      toast('Nama grup wajib diisi.', 'warning');
      return;
    }
    setIsSavingGroup(true);
    try {
      if (editingGroup) {
        const updated = await docGroupsService.update(editingGroup.id, groupForm.name, groupForm.description);
        setGroups(prev => prev.map(g => g.id === updated.id ? { ...updated, documentCount: g.documentCount } : g));
        toast(`Grup "${updated.name}" diperbarui.`, 'success');
      } else {
        const created = await docGroupsService.create(groupForm.name, groupForm.description);
        setGroups(prev => [...prev, created]);
        toast(`Grup "${created.name}" dibuat.`, 'success');
      }
      setIsGroupModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan grup.', 'error');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: DocGroup) => {
    const ok = await confirm(
      `Hapus grup "${g.name}"? Dokumen tidak akan ikut terhapus, hanya grup-nya saja.`,
      { title: 'Hapus Grup', variant: 'danger', confirmLabel: 'Ya, Hapus' }
    );
    if (!ok) return;
    try {
      await docGroupsService.delete(g.id);
      setGroups(prev => prev.filter(x => x.id !== g.id));
      setGroupDocuments(prev => { const n = { ...prev }; delete n[g.id]; return n; });
      toast(`Grup "${g.name}" dihapus.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus grup.', 'error');
    }
  };

  const handleRemoveFromGroup = async (groupId: number, doc: DocGroupDocument) => {
    try {
      await docGroupsService.removeMember(groupId, doc.id);
      setGroupDocuments(prev => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter(d => d.id !== doc.id),
      }));
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, documentCount: Math.max(0, g.documentCount - 1) } : g));
      toast(`"${doc.name}" dihapus dari grup.`, 'success');
    } catch {
      toast('Gagal menghapus dokumen dari grup.', 'error');
    }
  };

  // ─── Assign dokumen ke grup ───────────────────────────────────────────────
  const openAssignModal = async (doc: AuditDoc) => {
    setAssignDoc(doc);
    setAssignSelectedGroupIds([]);
    // tandai grup yang sudah berisi dokumen ini
    try {
      const current = await docGroupsService.getGroupsByDocument(doc.id);
      setAssignSelectedGroupIds(current.map(g => g.id));
    } catch {
      setAssignSelectedGroupIds([]);
    }
  };

  const toggleAssignGroup = (groupId: number) => {
    setAssignSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleAssignSave = async () => {
    if (!assignDoc) return;
    setIsAssigning(true);
    try {
      const current = await docGroupsService.getGroupsByDocument(assignDoc.id);
      const currentIds = new Set(current.map(g => g.id));
      const toAdd    = assignSelectedGroupIds.filter(id => !currentIds.has(id));
      const toRemove = [...currentIds].filter(id => !assignSelectedGroupIds.includes(id));

      await Promise.all([
        ...toAdd.map(gId => docGroupsService.addMembers(gId, [assignDoc.id])),
        ...toRemove.map(gId => docGroupsService.removeMember(gId, assignDoc.id)),
      ]);

      // refresh counts & docs caches yang berubah
      loadGroups();
      [...toAdd, ...toRemove].forEach(gId => {
        setGroupDocuments(prev => { const n = { ...prev }; delete n[gId]; return n; });
        if (expandedGroups.includes(gId)) loadGroupDocuments(gId);
      });

      toast(`Grup untuk "${assignDoc.name}" diperbarui.`, 'success');
      setAssignDoc(null);
    } catch (err: any) {
      toast(err.message || 'Gagal memperbarui grup.', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const addAuditLog = (action: string) => {
    const newLog: AuditLog = {
      id:     `LOG-${Date.now()}`,
      action,
      user:   'Admin',
      time:   new Date().toISOString(),
    };
    const updated = [newLog, ...auditLogs].slice(0, 50);
    setAuditLogs(updated);
    localStorage.setItem('accesstansi_audit_logs', JSON.stringify(updated));
  };

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filteredDocs = documents.filter(doc => {
    const matchSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || doc.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ─── Category toggle ──────────────────────────────────────────────────────
  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  // ─── Upload modal helpers ─────────────────────────────────────────────────
  const openUploadModal = (catKey?: string) => {
    setUploadForm({ name: '', category: catKey ?? (categories[0]?.categoryKey ?? 'LEGAL'), status: 'GREEN' });
    setSelectedFile(null);
    setIsUploadModalOpen(true);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    if (!uploadForm.name) {
      setUploadForm(prev => ({ ...prev, name: file.name }));
    }
  };

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = ()                    => setIsDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast('Pilih file terlebih dahulu.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const newDoc = await auditDocsService.upload(
        selectedFile,
        uploadForm.category,
        activeYear
      );
      setDocuments(prev => [newDoc, ...prev]);
      addAuditLog(`Mengunggah dokumen: ${newDoc.name}`);
      toast(`"${newDoc.name}" berhasil diunggah.`, 'success');
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({ name: '', category: 'LEGAL', status: 'GREEN' });
      if (!expandedCategories.includes(newDoc.category)) {
        setExpandedCategories(prev => [...prev, newDoc.category]);
      }
    } catch (err: any) {
      toast(err.message || 'Upload gagal.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Download ────────────────────────────────────────────────────────────
  const handleDownload = (doc: AuditDoc) => {
    toast(`Mengunduh "${doc.name}"...`, 'info');
    addAuditLog(`Mengunduh dokumen: ${doc.name}`);
    auditDocsService.download(doc);
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (doc: AuditDoc) => {
    const ok = await confirm(
      `Hapus dokumen "${doc.name}"? File akan dihapus permanen dari server.`,
      { title: 'Hapus Dokumen', variant: 'danger', confirmLabel: 'Ya, Hapus' }
    );
    if (!ok) return;
    try {
      await auditDocsService.delete(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      addAuditLog(`Menghapus dokumen: ${doc.name}`);
      toast(`Dokumen "${doc.name}" dihapus.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus dokumen.', 'error');
    }
  };

  // ─── Change status ───────────────────────────────────────────────────────
  const handleChangeStatus = async (doc: AuditDoc, status: ReadinessStatus) => {
    try {
      const updated = await auditDocsService.updateStatus(doc.id, status);
      setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
      addAuditLog(`Mengubah status "${doc.name}" menjadi ${status}`);
    } catch {
      toast('Gagal mengubah status.', 'error');
    }
  };

  // ─── Status badge ─────────────────────────────────────────────────────────
  const getStatusBadge = (status: ReadinessStatus) => {
    switch (status) {
      case 'GREEN':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> SIAP AUDIT
          </span>
        );
      case 'YELLOW':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> DRAFT
          </span>
        );
      case 'RED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3" /> BELUM ADA
          </span>
        );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Repository Dokumen Audit
          </h3>
          <p className="text-sm text-gray-500">
            Sentralisasi dokumen pendukung untuk kebutuhan audit eksternal &amp; internal.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setViewMode('kategori')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'kategori'
                  ? 'bg-white text-emerald-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" /> Kategori
            </button>
            <button
              onClick={() => setViewMode('grup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'grup'
                  ? 'bg-white text-emerald-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Grup
              {groups.length > 0 && (
                <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-bold">
                  {groups.length}
                </span>
              )}
            </button>
          </div>

          {/* Year selector — hanya di mode kategori */}
          {viewMode === 'kategori' && (
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border border-gray-200">
              <Archive className="w-4 h-4 text-gray-400 mr-2" />
              {isLoadingYears ? (
                <span className="text-sm text-gray-400">Memuat...</span>
              ) : years.length === 0 ? (
                <span className="text-sm text-gray-400">Belum ada periode</span>
              ) : (
                <select
                  value={activeYear}
                  onChange={e => setActiveYear(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 outline-none"
                >
                  {years.map(year => (
                    <option key={year} value={year}>Tahun Buku {year}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {viewMode === 'kategori' ? (
            <>
              <button
                onClick={openCreateCategory}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
              >
                <Tag className="w-4 h-4" /> Tambah Kategori
              </button>
              <button
                onClick={() => openUploadModal()}
                disabled={isUploading}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
              >
                {isUploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...</>
                  : <><Plus className="w-4 h-4" /> Upload Dokumen</>
                }
              </button>
            </>
          ) : (
            <button
              onClick={openCreateGroup}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              <FolderPlus className="w-4 h-4" /> Buat Grup
            </button>
          )}
        </div>
      </div>

      {/* Search, Filters, Loading, dan Kategori — hanya di mode kategori */}
      {viewMode === 'kategori' && (
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama dokumen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <Filter className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ReadinessStatus | 'ALL')}
              className="px-2 py-2 bg-transparent border-none outline-none text-sm text-gray-600 font-medium"
            >
              <option value="ALL">Semua Status</option>
              <option value="GREEN">Siap Audit</option>
              <option value="YELLOW">Draft</option>
              <option value="RED">Belum Ada</option>
            </select>
          </div>

          <button
            onClick={() => setIsAuditTrailOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <History className="w-4 h-4" /> Audit Trail
          </button>
        </div>
      </div>
      )}

      {/* Loading indicator */}
      {viewMode === 'kategori' && (isLoadingDocs || isLoadingCategories) && (
        <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat...</span>
        </div>
      )}

      {/* Categories List */}
      {viewMode === 'kategori' && !isLoadingDocs && !isLoadingCategories && (
        <div className="space-y-4">
          {categories.map(cat => {
            const catDocs = filteredDocs.filter(d => d.category === cat.categoryKey);
            const isExpanded = expandedCategories.includes(cat.categoryKey);

            return (
              <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {/* Category Header */}
                <div
                  className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors ${
                    isExpanded ? 'bg-gray-50 border-b border-gray-100' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleCategory(cat.categoryKey)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      catDocs.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <FolderArchive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        {cat.label}
                        {!cat.isDefault && (
                          <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">Kustom</span>
                        )}
                      </h4>
                      {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1">
                      <span className="text-xs font-medium text-gray-400 mr-1">{catDocs.length} Dokumen</span>
                      <button
                        onClick={e => { e.stopPropagation(); openUploadModal(cat.categoryKey); }}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all"
                        title="Upload dokumen ke kategori ini"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEditCategory(cat); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                        title="Ubah kategori"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!cat.isDefault && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          title="Hapus kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronDown  className="w-5 h-5 text-gray-400" />
                      : <ChevronRight className="w-5 h-5 text-gray-400" />
                    }
                  </div>
                </div>

                {/* Document List */}
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    {catDocs.length > 0 ? (
                      catDocs.map(doc => {
                        const st = STATUS_STYLE[doc.status];
                        return (
                          <div
                            key={doc.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors gap-4"
                          >
                            {/* Doc info */}
                            <div className="flex items-start gap-3">
                              <div className="mt-1 p-2 bg-gray-100 rounded text-gray-400">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                                  {doc.journalRef && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                      <ExternalLink className="w-2.5 h-2.5" /> {doc.journalRef}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Upload className="w-3 h-3" />
                                    {doc.uploadedBy ?? 'Admin'} • {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                                  </span>
                                  {doc.fileSize && (
                                    <span className="text-[10px] text-gray-400">{doc.fileSize}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <select
                                value={doc.status}
                                onChange={e => handleChangeStatus(doc, e.target.value as ReadinessStatus)}
                                onClick={e => e.stopPropagation()}
                                className="text-[10px] font-bold rounded-full border px-2 py-1 outline-none cursor-pointer"
                                style={{ backgroundColor: st.bg, color: st.text, borderColor: st.border }}
                              >
                                <option value="GREEN">✓ SIAP AUDIT</option>
                                <option value="YELLOW">⏳ DRAFT</option>
                                <option value="RED">✗ BELUM ADA</option>
                              </select>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openAssignModal(doc)}
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Tambah ke Grup"
                                >
                                  <Tags className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(doc)}
                                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(doc)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-5 py-10 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                          <Archive className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-gray-500">Belum ada dokumen di kategori ini.</p>
                        <button
                          onClick={() => openUploadModal(cat.categoryKey)}
                          className="mt-4 text-xs font-bold text-emerald-600 hover:underline"
                        >
                          + Tambah Dokumen Pertama
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── VIEW GRUP ─────────────────────────────────────────────────────── */}
      {viewMode === 'grup' && (
        <div className="space-y-4">
          {isLoadingGroups ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Memuat grup...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                <Layers className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium text-gray-500">Belum ada grup dokumen</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Buat grup untuk mengelompokkan dokumen sesuai kebutuhan audit atau internal</p>
              <button
                onClick={openCreateGroup}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                <FolderPlus className="w-4 h-4" /> Buat Grup Pertama
              </button>
            </div>
          ) : (
            groups.map(group => {
              const isExpanded = expandedGroups.includes(group.id);
              const docs = groupDocuments[group.id] ?? [];
              const isLoadingDocs = loadingGroupDocs[group.id];

              return (
                <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  {/* Group Header */}
                  <div
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-gray-50 border-b border-gray-100' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        group.documentCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{group.name}</h4>
                        {group.description && (
                          <p className="text-xs text-gray-500">{group.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-400 hidden sm:block">
                        {group.documentCount} Dokumen
                      </span>
                      <div className="hidden sm:flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); openEditGroup(group); }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="Ubah nama grup"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteGroup(group); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          title="Hapus grup"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-gray-400" />
                        : <ChevronRight className="w-5 h-5 text-gray-400" />
                      }
                    </div>
                  </div>

                  {/* Group Documents */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-50">
                      {isLoadingDocs ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Memuat...</span>
                        </div>
                      ) : docs.length > 0 ? (
                        docs.map(doc => {
                          const st = STATUS_STYLE[doc.status];
                          return (
                            <div
                              key={doc.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-gray-50/50 gap-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1 p-2 bg-gray-100 rounded text-gray-400">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                    <span className="text-[10px] text-gray-400">
                                      {doc.uploadedBy ?? 'Admin'} • {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                                    </span>
                                    {doc.fileSize && (
                                      <span className="text-[10px] text-gray-400">{doc.fileSize}</span>
                                    )}
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border"
                                      style={{ backgroundColor: st.bg, color: st.text, borderColor: st.border }}
                                    >
                                      {doc.status === 'GREEN' ? 'SIAP AUDIT' : doc.status === 'YELLOW' ? 'DRAFT' : 'BELUM ADA'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => handleDownload(doc)}
                                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRemoveFromGroup(group.id, doc)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Hapus dari grup ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-5 py-10 text-center">
                          <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                            <Tag className="w-5 h-5" />
                          </div>
                          <p className="text-sm text-gray-500">Belum ada dokumen di grup ini.</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Tambahkan dokumen dari tab <span className="font-bold">Kategori</span> → ikon <Tags className="w-3 h-3 inline" />
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800 leading-relaxed">
          <p className="font-bold mb-1 uppercase tracking-wider">Keamanan &amp; Kepatuhan:</p>
          <p>
            Seluruh dokumen tersimpan di server dan hanya dapat diakses oleh pengguna yang
            terautentikasi. Setiap aktivitas (unggah, unduh, hapus) dicatat dalam Audit Trail
            untuk transparansi penuh selama proses audit.
          </p>
        </div>
      </div>

      {/* ─── Upload Modal ──────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white">
              <h2 className="text-xl font-bold">Upload Dokumen Baru</h2>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* Kategori & Tahun */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={uploadForm.category}
                    onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.categoryKey}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Buku</label>
                  <input
                    type="text"
                    readOnly
                    value={activeYear}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-bold text-gray-700"
                  />
                </div>
              </div>

              {/* Drag & Drop area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Dokumen</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50'
                      : selectedFile
                        ? 'border-emerald-300 bg-gray-50'
                        : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={e => handleFileSelect(e.target.files)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                  />
                  {selectedFile ? (
                    <>
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(0)} KB • Klik untuk ganti file
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
                      <p className="text-xs text-gray-500">
                        {isDragging ? 'Lepas file di sini' : 'Klik untuk pilih file atau drag & drop'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">PDF, DOC, XLS, JPG, PNG, ZIP (Max 15MB)</p>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-bold flex items-center justify-center gap-2"
                >
                  {isUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...</>
                    : <><Upload className="w-4 h-4" /> Simpan Dokumen</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Buat / Edit Kategori ──────────────────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-700 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5" />
                {editingCategory ? 'Ubah Kategori' : 'Tambah Kategori Baru'}
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.label}
                  onChange={e => setCategoryForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="mis. Investasi, Aset Tetap, Dokumen HR..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={e => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Keterangan singkat tentang jenis dokumen di kategori ini..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>
              {editingCategory?.isDefault && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Kategori bawaan hanya bisa diubah namanya, tidak bisa dihapus.
                </p>
              )}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory || !categoryForm.label.trim()}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-bold flex items-center justify-center gap-2"
                >
                  {isSavingCategory
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    : editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Buat / Edit Grup ───────────────────────────────────────── */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {editingGroup ? 'Ubah Nama Grup' : 'Buat Grup Baru'}
              </h2>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Grup <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={e => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="mis. Audit Laporan Q1 2024, Dokumen Legal Internal..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi <span className="text-gray-400 font-normal">(opsional)</span></label>
                <textarea
                  value={groupForm.description}
                  onChange={e => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Keterangan singkat tentang isi grup..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingGroup || !groupForm.name.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-bold flex items-center justify-center gap-2"
                >
                  {isSavingGroup
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    : editingGroup ? 'Simpan Perubahan' : 'Buat Grup'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Assign Dokumen ke Grup ─────────────────────────────────── */}
      {assignDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tags className="w-5 h-5" /> Atur Grup Dokumen
              </h2>
              <button onClick={() => setAssignDoc(null)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{assignDoc.name}</span>
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada grup. Buat grup terlebih dahulu.</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Pilih grup untuk dokumen ini:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {groups.map(g => (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={assignSelectedGroupIds.includes(g.id)}
                          onChange={() => toggleAssignGroup(g.id)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{g.name}</span>
                          {g.description && (
                            <p className="text-xs text-gray-400 truncate">{g.description}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{g.documentCount} dok</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setAssignDoc(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleAssignSave}
                  disabled={isAssigning || groups.length === 0}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-bold flex items-center justify-center gap-2"
                >
                  {isAssigning
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    : 'Simpan'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Audit Trail Modal ────────────────────────────────────────────── */}
      {isAuditTrailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-800 text-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                <h2 className="text-xl font-bold">Audit Trail Repository</h2>
              </div>
              <button onClick={() => setIsAuditTrailOpen(false)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Belum ada aktivitas tercatat.</p>
                  <p className="text-xs mt-1 text-gray-400">Aktivitas upload, download, dan hapus dokumen akan tercatat di sini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <History className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 font-medium">{log.action}</p>
                        <p className="text-[10px] text-gray-500">
                          Oleh: {log.user} • {new Date(log.time).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setIsAuditTrailOpen(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
