import { apiGet, apiPost } from './api';
import { POSTransaction, POSPaymentMethod } from '../../types';

export interface POSCheckoutInput {
  customerId?: string;
  discount?: number;
  tax?: number;
  paymentMethod: POSPaymentMethod;
  paidAmount: number;
  lines: { productId: string; qty: number; unitPrice: number; discount?: number }[];
}

export const posService = {
  getAll: (params?: { shiftId?: string; status?: string }): Promise<POSTransaction[]> => {
    const qs = new URLSearchParams();
    if (params?.shiftId) qs.set('shiftId', params.shiftId);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString();
    return apiGet<POSTransaction[]>(`/pos${query ? `?${query}` : ''}`);
  },

  getById: (id: string): Promise<POSTransaction> =>
    apiGet<POSTransaction>(`/pos/${id}`),

  checkout: (data: POSCheckoutInput): Promise<POSTransaction> =>
    apiPost<POSTransaction>('/pos/checkout', data),

  void: (id: string): Promise<POSTransaction> =>
    apiPost<POSTransaction>(`/pos/${id}/void`, {}),
};
