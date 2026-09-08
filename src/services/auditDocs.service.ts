import { apiFetch } from './api';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export interface AuditDoc {
  id: number;
  name: string;
  category: string;
  year: string;
  status: 'RED' | 'YELLOW' | 'GREEN';
  uploadedBy: string | null;
  fileSize: string | null;
  filePath: string;
  mimeType: string | null;
  journalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export const auditDocsService = {
  /** Ambil semua dokumen, opsional filter by tahun */
  getAll: (year?: string): Promise<AuditDoc[]> =>
    apiFetch<AuditDoc[]>(`/api/audit-docs${year ? `?year=${encodeURIComponent(year)}` : ''}`),

  /** Upload file dokumen baru */
  upload: (
    file: File,
    category: string,
    year: string,
    journalRef?: string
  ): Promise<AuditDoc> => {
    const token = localStorage.getItem('accesstansi_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('year', year);
    if (journalRef) formData.append('journalRef', journalRef);

    return fetch(`${BASE_URL}/api/audit-docs/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      // Jangan set Content-Type — biarkan browser set multipart boundary otomatis
    }).then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(body.error || 'Upload gagal');
      }
      return r.json() as Promise<AuditDoc>;
    });
  },

  /** Ubah status dokumen (RED / YELLOW / GREEN) */
  updateStatus: (id: number, status: AuditDoc['status']): Promise<AuditDoc> =>
    apiFetch<AuditDoc>(`/api/audit-docs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  /** Download file — trigger browser download */
  download: (doc: AuditDoc): void => {
    const token = localStorage.getItem('accesstansi_token');
    fetch(`${BASE_URL}/api/audit-docs/${doc.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error('Download gagal');
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch(err => console.error('Download error:', err));
  },

  /** Hapus dokumen (file + record DB) */
  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/api/audit-docs/${id}`, { method: 'DELETE' }),
};
