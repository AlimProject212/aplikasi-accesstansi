import { HierarchicalAccount } from '../types';
import { apiFetch } from './api';

export const accountsService = {
  getAll: () =>
    apiFetch<HierarchicalAccount[]>('/api/accounts'),

  getById: (id: string) =>
    apiFetch<HierarchicalAccount>(`/api/accounts/${id}`),

  create: (data: Omit<HierarchicalAccount, 'children'>) =>
    apiFetch<HierarchicalAccount>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<HierarchicalAccount>) =>
    apiFetch<HierarchicalAccount>(`/api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/api/accounts/${id}`, { method: 'DELETE' }),

  bulkCreate: (accounts: Omit<HierarchicalAccount, 'children'>[], replace = false) =>
    apiFetch<HierarchicalAccount[]>('/api/accounts/bulk', {
      method: 'POST',
      body: JSON.stringify({ accounts, replace }),
    }),

  updateCashFlow: (updates: { id: string; cashFlowCategory: string | null }[]) =>
    apiFetch<{ updated: number }>('/api/accounts/cash-flow', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    }),
};
