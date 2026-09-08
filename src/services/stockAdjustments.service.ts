import { apiGet, apiPost, apiDel } from './api';
import { StockAdjustment } from '../../types';

export interface StockAdjustmentInput {
  warehouseId?: number;
  date: string;
  reason?: string;
  lines: { productId: string; actualQty: number }[];
}

export const stockAdjustmentsService = {
  getAll: (status?: 'DRAFT' | 'POSTED'): Promise<StockAdjustment[]> =>
    apiGet<StockAdjustment[]>(`/stock-adjustments${status ? `?status=${status}` : ''}`),

  getById: (id: string): Promise<StockAdjustment> =>
    apiGet<StockAdjustment>(`/stock-adjustments/${id}`),

  create: (data: StockAdjustmentInput): Promise<StockAdjustment> =>
    apiPost<StockAdjustment>('/stock-adjustments', data),

  post: (id: string): Promise<StockAdjustment> =>
    apiPost<StockAdjustment>(`/stock-adjustments/${id}/post`, {}),

  delete: (id: string): Promise<void> =>
    apiDel<void>(`/stock-adjustments/${id}`),
};
