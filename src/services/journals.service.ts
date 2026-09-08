import { JournalEntry } from '../types';
import { apiFetch } from './api';

export const journalsService = {
  getAll: (params?: { status?: string; from?: string; to?: string; search?: string; period?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.search) qs.set('search', params.search);
    if (params?.period) qs.set('period', params.period);
    const qStr = qs.toString();
    return apiFetch<JournalEntry[]>(`/api/journals${qStr ? `?${qStr}` : ''}`);
  },

  getById: (id: string) =>
    apiFetch<JournalEntry>(`/api/journals/${id}`),

  create: (data: Omit<JournalEntry, 'id' | 'createdAt'> & { id?: string }) =>
    apiFetch<JournalEntry>('/api/journals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<JournalEntry>) =>
    apiFetch<JournalEntry>(`/api/journals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/api/journals/${id}`, { method: 'DELETE' }),

  /** SUPERADMIN-only mass delete */
  bulkDelete: (ids: string[]) =>
    apiFetch<{ deleted: number }>('/api/journals/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  updateStatus: (id: string, status: 'POSTED' | 'VOID') =>
    apiFetch<JournalEntry>(`/api/journals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  /** Update/remove attachment — works for any journal status */
  updateAttachment: (id: string, attachment: string | null, attachmentName: string | null) =>
    apiFetch<JournalEntry>(`/api/journals/${id}/attachment`, {
      method: 'PATCH',
      body: JSON.stringify({ attachment, attachmentName }),
    }),
};
