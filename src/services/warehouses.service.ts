import { apiGet, apiPost, apiPut, apiDel } from './api';
import { Warehouse } from '../../types';

export const warehousesService = {
  getAll: (): Promise<Warehouse[]> =>
    apiGet<Warehouse[]>('/warehouses'),

  create: (name: string, address?: string): Promise<Warehouse> =>
    apiPost<Warehouse>('/warehouses', { name, address }),

  update: (id: number, data: Partial<Pick<Warehouse, 'name' | 'address' | 'isActive'>>): Promise<Warehouse> =>
    apiPut<Warehouse>(`/warehouses/${id}`, data),

  delete: (id: number): Promise<void> =>
    apiDel<void>(`/warehouses/${id}`),
};
