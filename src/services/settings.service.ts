import { CompanyProfile, AppConfig, AccountBudget } from '../types';
import { apiFetch } from './api';

export const settingsService = {
  getProfile: () => apiFetch<CompanyProfile>('/api/settings/profile'),
  updateProfile: (data: Partial<CompanyProfile>) =>
    apiFetch<CompanyProfile>('/api/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getConfig: () => apiFetch<AppConfig>('/api/settings/config'),
  updateConfig: (data: Partial<AppConfig>) =>
    apiFetch<AppConfig>('/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  backup: () => apiFetch<Record<string, unknown>>('/api/settings/backup'),
};

export const budgetsService = {
  getAll: (year?: string) => {
    const qs = year ? `?year=${year}` : '';
    return apiFetch<(AccountBudget & { account: { id: string; code: string; name: string; type: string } })[]>(
      `/api/budgets${qs}`
    );
  },

  upsertAll: (year: string, budgets: AccountBudget[]) =>
    apiFetch('/api/budgets', {
      method: 'PUT',
      body: JSON.stringify({ year, budgets }),
    }),
};

export const periodsService = {
  getAll: () =>
    apiFetch<{ id: number; year: string; isActive: boolean; lockedMonths: { id: number; yearMonth: string }[] }[]>(
      '/api/periods'
    ),

  create: (year: string) =>
    apiFetch('/api/periods', { method: 'POST', body: JSON.stringify({ year }) }),

  delete: (year: string) =>
    apiFetch<void>(`/api/periods/${year}`, { method: 'DELETE' }),

  setActive: (year: string) =>
    apiFetch(`/api/periods/${year}/active`, { method: 'PATCH' }),

  lockMonth: (year: string, month: string) =>
    apiFetch(`/api/periods/${year}/lock`, { method: 'POST', body: JSON.stringify({ month }) }),

  unlockMonth: (year: string, yearMonth: string) =>
    apiFetch<void>(`/api/periods/${year}/lock/${yearMonth}`, { method: 'DELETE' }),
};

export const usersService = {
  getAll: () => apiFetch<any[]>('/api/users'),
  create: (data: any) =>
    apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
  changePassword: (id: number, newPassword: string) =>
    apiFetch(`/api/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword }) }),
};

export interface ApiKeyConfig {
  id: number;
  serviceName: string;
  keyName: string;
  keyValue: string; // masked from server, plain when revealed
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const apiKeysService = {
  getAll: () => apiFetch<ApiKeyConfig[]>('/api/settings/api-keys'),

  create: (data: {
    serviceName: string;
    keyName: string;
    keyValue: string;
    description?: string;
    isActive?: boolean;
  }) =>
    apiFetch<ApiKeyConfig>('/api/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: {
    serviceName?: string;
    keyName?: string;
    keyValue?: string;
    description?: string;
    isActive?: boolean;
  }) =>
    apiFetch<ApiKeyConfig>(`/api/settings/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<void>(`/api/settings/api-keys/${id}`, { method: 'DELETE' }),

  reveal: (id: number) =>
    apiFetch<{ keyValue: string }>(`/api/settings/api-keys/${id}/reveal`),
};
