import { apiGet, apiPost } from './api';
import { PurchasePayment } from '../../types';

export interface PurchasePaymentInput {
  receiptId: string;
  paymentDate: string;
  amount: number;
  accountId: string;
  notes?: string;
}

export const purchasePaymentsService = {
  getAll: (receiptId?: string): Promise<PurchasePayment[]> =>
    apiGet<PurchasePayment[]>(`/purchase-payments${receiptId ? `?receiptId=${receiptId}` : ''}`),

  create: (data: PurchasePaymentInput): Promise<{ id: string; journalEntryId: string }> =>
    apiPost<{ id: string; journalEntryId: string }>('/purchase-payments', data),
};
