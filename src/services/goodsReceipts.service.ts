import { apiGet, apiPost, apiDel } from './api';
import { GoodsReceipt } from '../../types';

export interface GoodsReceiptInput {
  poId?: string;
  vendorId: string;
  warehouseId?: number;
  receiptDate: string;
  notes?: string;
  lines: { productId: string; qty: number; unitCost: number }[];
}

export const goodsReceiptsService = {
  getAll: (status?: 'DRAFT' | 'POSTED'): Promise<GoodsReceipt[]> =>
    apiGet<GoodsReceipt[]>(`/goods-receipts${status ? `?status=${status}` : ''}`),

  getById: (id: string): Promise<GoodsReceipt> =>
    apiGet<GoodsReceipt>(`/goods-receipts/${id}`),

  create: (data: GoodsReceiptInput): Promise<GoodsReceipt> =>
    apiPost<GoodsReceipt>('/goods-receipts', data),

  post: (id: string): Promise<GoodsReceipt> =>
    apiPost<GoodsReceipt>(`/goods-receipts/${id}/post`, {}),

  delete: (id: string): Promise<void> =>
    apiDel<void>(`/goods-receipts/${id}`),
};
