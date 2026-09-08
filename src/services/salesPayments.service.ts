import { apiGet, apiPost } from './api';
import { SalesPayment } from '../../types';

export interface SalesPaymentInput {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  accountId: string;
  notes?: string;
}

export const salesPaymentsService = {
  getAll: (invoiceId?: string): Promise<SalesPayment[]> =>
    apiGet<SalesPayment[]>(`/sales-payments${invoiceId ? `?invoiceId=${invoiceId}` : ''}`),

  create: (data: SalesPaymentInput): Promise<{ id: string; journalEntryId: string }> =>
    apiPost<{ id: string; journalEntryId: string }>('/sales-payments', data),
};
