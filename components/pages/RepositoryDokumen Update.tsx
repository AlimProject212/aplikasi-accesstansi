
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
  XCircle
} from 'lucide-react';

type ReadinessStatus = 'RED' | 'YELLOW' | 'GREEN';

interface AuditDocument {
  id: string;
  name: string;
  category: 'LEGAL' | 'FINANCE' | 'TAX' | 'OPERATIONAL' | 'OTHER';
  year: string;
  status: ReadinessStatus;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
  journalRef?: string;
}

const CATEGORIES = [
  { id: 'LEGAL', label: 'Legalitas', desc: 'Akta pendirian, TDP, NIB, Izin Operasional' },
  { id: 'FINANCE', label: 'Keuangan', desc: 'Laporan audit tahun sebelumnya, rekonsiliasi bank tahunan' },
  { id: 'TAX', label: 'Perpajakan', desc: 'SPT Tahunan, bukti potong, SSP' },
  { id: 'OPERATIONAL', label: 'Operasional', desc: 'Kontrak dengan supplier dan lainnya' },
  { id: 'OTHER', label: 'Lainnya', desc: 'Dokumen pendukung lainnya' },
];

export const RepositoryDokumen: React.FC = () => {
  const [activeYear, setActiveYear] = useState<string>(() => {
    return localStorage.getItem('active_period') || new Date().getFullYear().toString();
  });
  
  const [years, setYears] = useState<string[]>(() => {
    const savedYears = localStorage.getItem('accesstansi_audit_years');
    return savedYears ? JSON.parse(savedYears) : ['2023', '2024', '2025'];
  });
  
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['LEGAL', 'FINANCE', 'TAX', 'OPERATIONAL', 'OTHER']);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadinessStatus | 'ALL'>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; user: string; time: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'LEGAL' as AuditDocument['category'],
    status: 'GREEN' as ReadinessStatus
  });

  useEffect(() => {
    const savedDocs = localStorage.getItem('accesstansi_audit_docs');
    if (savedDocs) {
      setDocuments(JSON.parse(savedDocs));
    } else {
      // Mock initial data
      const mockDocs: AuditDocument[] = [
        { 
          id: '1', 
          name: 'Akta Pendirian Perusahaan.pdf', 
          category: 'LEGAL', 
          year: '2024', 
          status: 'GREEN', 
          uploadedBy: 'Admin', 
          uploadedAt: '2024-01-15T10:00:00Z', 
          fileSize: '2.4 MB' 
        },
        { 
          id: '2', 
          name: 'NIB 2024.pdf', 
          category: 'LEGAL', 
          year: '2024', 
          status: 'GREEN', 
          uploadedBy: 'Admin', 
          uploadedAt: '2024-01-16T11:30:00Z', 
          fileSize: '1.1 MB' 
        },
        { 
          id: '3', 
          name: 'SPT Tahunan 2023.pdf', 
          category: 'TAX', 
          year: '2024', 
          status: 'YELLOW', 
          uploadedBy: 'Staff Pajak', 
          uploadedAt: '2024-03-20T09:15:00Z', 
          fileSize: '4.5 MB' 
        },
        { 
          id: '4', 
          name: 'Kontrak Sewa Kantor 2024-2026.pdf', 
          category: 'OPERATIONAL', 
          year: '2024', 
          status: 'GREEN', 
          uploadedBy: 'Admin', 
          uploadedAt: '2024-02-01T14:20:00Z', 
          fileSize: '3.2 MB',
          journalRef: 'JV-2024-005'
        }
      ];
      setDocuments(mockDocs);
      localStorage.setItem('accesstansi_audit_docs', JSON.stringify(mockDocs));
    }

    const savedLogs = localStorage.getItem('accesstansi_audit_logs');
    if (savedLogs) {
      setAuditLogs(JSON.parse(savedLogs));
    }
  }, []);

  const addAuditLog = (action: string) => {
    const newLog = {
      id: `LOG-${Date.now()}`,
      action,
      user: 'Admin',
      time: new Date().toISOString()
    };
    const updatedLogs = [newLog, ...auditLogs].slice(0, 50); // Keep last 50
    setAuditLogs(updatedLogs);
    localStorage.setItem('accesstansi_audit_logs', JSON.stringify(updatedLogs));
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

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

  const filteredDocs = documents.filter(doc => 
    doc.year === activeYear && 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (statusFilter === 'ALL' || doc.status === statusFilter)
  );

  const handleBulkDownload = (catId: string) => {
    alert(`Mengunduh seluruh dokumen kategori ${catId} dalam format .zip...`);
  };

  const handleAddYear = () => {
    const nextYear = (Math.max(...years.map(Number)) + 1).toString();
    const newYear = window.prompt('Masukkan Tahun Buku Baru (YYYY):', nextYear);
    
    if (newYear && /^\d{4}$/.test(newYear)) {
      if (years.includes(newYear)) {
        alert('Tahun buku tersebut sudah ada.');
        return;
      }
      const updatedYears = [...years, newYear].sort((a, b) => Number(b) - Number(a));
      setYears(updatedYears);
      localStorage.setItem('accesstansi_audit_years', JSON.stringify(updatedYears));
      setActiveYear(newYear);
    } else if (newYear !== null) {
      alert('Format tahun tidak valid. Gunakan format YYYY (contoh: 2026).');
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const fileName = uploadForm.name || (selectedFile ? selectedFile.name : 'Dokumen Tanpa Nama');
    const fileSize = selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(Math.random() * 5 + 0.5).toFixed(1)} MB`;

    const newDoc: AuditDocument = {
      id: `DOC-${Date.now()}`,
      name: fileName,
      category: uploadForm.category,
      year: activeYear,
      status: uploadForm.status,
      uploadedBy: 'Admin', // In real app, get from auth
      uploadedAt: new Date().toISOString(),
      fileSize: fileSize
    };

    const updatedDocs = [newDoc, ...documents];
    setDocuments(updatedDocs);
    localStorage.setItem('accesstansi_audit_docs', JSON.stringify(updatedDocs));
    addAuditLog(`Mengunggah dokumen: ${newDoc.name}`);
    setIsUploadModalOpen(false);
    setUploadForm({ name: '', category: 'LEGAL', status: 'GREEN' });
    setSelectedFile(null);
    
    // Auto expand the category to show the new doc
    if (!expandedCategories.includes(newDoc.category)) {
      setExpandedCategories([...expandedCategories, newDoc.category]);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      // Pre-fill name if empty
      if (!uploadForm.name) {
        setUploadForm(prev => ({ ...prev, name: file.name }));
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDeleteDoc = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc && window.confirm(`Apakah Anda yakin ingin menghapus dokumen "${doc.name}"?`)) {
      const updatedDocs = documents.filter(d => d.id !== id);
      setDocuments(updatedDocs);
      localStorage.setItem('accesstansi_audit_docs', JSON.stringify(updatedDocs));
      addAuditLog(`Menghapus dokumen: ${doc.name}`);
    }
  };

  const handleDownloadDoc = (doc: AuditDocument) => {
    alert(`Mengunduh file: ${doc.name}...`);
    addAuditLog(`Mengunduh dokumen: ${doc.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Repository Dokumen Audit
          </h3>
          <p className="text-sm text-gray-500">Sentralisasi dokumen pendukung untuk kebutuhan audit eksternal & internal.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border border-gray-200">
            <Archive className="w-4 h-4 text-gray-400 mr-2" />
            <select 
              value={activeYear} 
              onChange={(e) => setActiveYear(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 outline-none"
            >
              {years.map(year => (
                <option key={year} value={year}>Tahun Buku {year}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleAddYear}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Tambah Tahun
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Upload Dokumen
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari nama dokumen..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="GREEN">SIAP AUDIT</option>
              <option value="YELLOW">DRAFT</option>
              <option value="RED">BELUM ADA</option>
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button 
            onClick={() => setIsAuditTrailOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <History className="w-4 h-4" /> Audit Trail
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {CATEGORIES.map(cat => {
          const catDocs = filteredDocs.filter(d => d.category === cat.id);
          const isExpanded = expandedCategories.includes(cat.id);
          
          return (
            <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* Category Header */}
              <div 
                className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50 border-b border-gray-100' : 'hover:bg-gray-50'}`}
                onClick={() => toggleCategory(cat.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${catDocs.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{cat.label}</h4>
                    <p className="text-xs text-gray-500">{cat.desc}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">{catDocs.length} Dokumen</span>
                    {catDocs.length > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleBulkDownload(cat.id); }}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all"
                        title="Download Semua (.zip)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {/* Document List */}
              {isExpanded && (
                <div className="divide-y divide-gray-50">
                  {catDocs.length > 0 ? (
                    catDocs.map(doc => (
                      <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors gap-4">
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
                                <Upload className="w-3 h-3" /> {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleDateString('id-ID')}
                              </span>
                              <span className="text-[10px] text-gray-400">{doc.fileSize}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          {getStatusBadge(doc.status)}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDownloadDoc(doc)}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                        <Archive className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-gray-500">Belum ada dokumen di kategori ini.</p>
                      <button 
                        onClick={() => {
                          setUploadForm({ ...uploadForm, category: cat.id as any });
                          setIsUploadModalOpen(true);
                        }}
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

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white">
              <h2 className="text-xl font-bold">Upload Dokumen Baru</h2>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-white opacity-70 hover:opacity-100">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dokumen</label>
                <input 
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Contoh: Akta Pendirian.pdf"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Kesiapan</label>
                  <select 
                    value={uploadForm.status}
                    onChange={(e) => setUploadForm({ ...uploadForm, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="GREEN">SIAP AUDIT</option>
                    <option value="YELLOW">DRAFT</option>
                    <option value="RED">BELUM ADA</option>
                  </select>
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : selectedFile 
                      ? 'border-emerald-200 bg-gray-50' 
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                
                {selectedFile ? (
                  <>
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(0)} KB • Klik untuk ganti file</p>
                  </>
                ) : (
                  <>
                    <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
                    <p className="text-xs text-gray-500">
                      {isDragging ? 'Lepas file di sini' : 'Klik untuk pilih file atau drag & drop'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG (Max 10MB)</p>
                  </>
                )}
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
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-bold"
                >
                  Simpan Dokumen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
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
                  <p>Belum ada aktivitas tercatat.</p>
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
                        <p className="text-[10px] text-gray-500">Oleh: {log.user} • {new Date(log.time).toLocaleString('id-ID')}</p>
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

      {/* Footer Info */}
      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800 leading-relaxed">
          <p className="font-bold mb-1 uppercase tracking-wider">Keamanan & Kepatuhan:</p>
          <p>Seluruh dokumen dienkripsi dan hanya dapat diakses oleh pengguna dengan role Admin atau Supervisor. Setiap aktivitas (unggah, unduh, hapus) dicatat dalam sistem Audit Trail untuk transparansi penuh selama proses audit.</p>
        </div>
      </div>
    </div>
  );
};
