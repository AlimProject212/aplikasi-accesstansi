import { apiGet, apiPost, apiPut, apiDel } from './api';
import { ProductCategory } from '../../types';

export const productCategoriesService = {
  getAll: (): Promise<ProductCategory[]> =>
    apiGet<ProductCategory[]>('/product-categories'),

  create: (name: string): Promise<ProductCategory> =>
    apiPost<ProductCategory>('/product-categories', { name }),

  update: (id: number, name: string): Promise<ProductCategory> =>
    apiPut<ProductCategory>(`/product-categories/${id}`, { name }),

  delete: (id: number): Promise<void> =>
    apiDel<void>(`/product-categories/${id}`),
};
