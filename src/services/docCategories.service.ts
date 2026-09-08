import { apiFetch } from './api';

export interface DocCategory {
  id: number;
  companyId: number;
  label: string;
  categoryKey: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const docCategoriesService = {
  getAll: (): Promise<DocCategory[]> =>
    apiFetch<DocCategory[]>('/api/doc-categories'),

  create: (label: string, description?: string): Promise<DocCategory> =>
    apiFetch<DocCategory>('/api/doc-categories', {
      method: 'POST',
      body: JSON.stringify({ label, description }),
    }),

  update: (id: number, label: string, description?: string): Promise<DocCategory> =>
    apiFetch<DocCategory>(`/api/doc-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ label, description }),
    }),

  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/api/doc-categories/${id}`, { method: 'DELETE' }),
};
