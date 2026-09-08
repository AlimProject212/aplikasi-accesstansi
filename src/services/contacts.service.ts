import { Contact } from '../types';
import { apiFetch } from './api';

export const contactsService = {
  getAll: (params?: { type?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    return apiFetch<Contact[]>(`/api/contacts?${qs}`);
  },

  getById: (id: string) =>
    apiFetch<Contact>(`/api/contacts/${id}`),

  create: (data: Omit<Contact, 'id'> & { id?: string }) =>
    apiFetch<Contact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Contact>) =>
    apiFetch<Contact>(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
};
