import { apiGet, apiPost, apiPut, apiDel } from './api';
import { PurchaseOrder, POStatus } from '../../types';

export interface PurchaseOrderInput {
  vendorId: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  lines: { productId: string; qtyOrdered: number; unitPrice: number }[];
}

export const purchaseOrdersService = {
  getAll: (status?: POStatus): Promise<PurchaseOrder[]> =>
    apiGet<PurchaseOrder[]>(`/purchase-orders${status ? `?status=${status}` : ''}`),

  getById: (id: string): Promise<PurchaseOrder> =>
    apiGet<PurchaseOrder>(`/purchase-orders/${id}`),

  create: (data: PurchaseOrderInput): Promise<PurchaseOrder> =>
    apiPost<PurchaseOrder>('/purchase-orders', data),

  update: (id: string, data: Partial<PurchaseOrderInput>): Promise<PurchaseOrder> =>
    apiPut<PurchaseOrder>(`/purchase-orders/${id}`, data),

  updateStatus: (id: string, status: POStatus): Promise<PurchaseOrder> =>
    apiPut<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),

  delete: (id: string): Promise<void> =>
    apiDel<void>(`/purchase-orders/${id}`),
};
