import { apiGet, apiPost, apiPut, apiDel } from './api';
import { Product } from '../../types';

export interface ProductInput {
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: number | null;
  unitId?: number | null;
  purchasePrice?: number;
  sellPrice?: number;
  minStock?: number;
  isActive?: boolean;
}

export const productsService = {
  getAll: (params?: { search?: string; categoryId?: number; isActive?: boolean }): Promise<Product[]> => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.categoryId) qs.set('categoryId', String(params.categoryId));
    if (params?.isActive !== undefined) qs.set('isActive', String(params.isActive));
    const query = qs.toString();
    return apiGet<Product[]>(`/products${query ? `?${query}` : ''}`);
  },

  getById: (id: string): Promise<Product> =>
    apiGet<Product>(`/products/${id}`),

  create: (data: ProductInput): Promise<Product> =>
    apiPost<Product>('/products', data),

  update: (id: string, data: Partial<ProductInput>): Promise<Product> =>
    apiPut<Product>(`/products/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiDel<void>(`/products/${id}`),
};
