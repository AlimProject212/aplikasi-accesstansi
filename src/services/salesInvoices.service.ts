import { apiGet, apiPost, apiDel } from './api';
import { SalesInvoice, SalesInvoiceStatus } from '../../types';

export interface SalesInvoiceInput {
  customerId: string;
  warehouseId?: number;
  invoiceDate: string;
  dueDate?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  lines: { productId: string; qty: number; unitPrice: number }[];
}

export const salesInvoicesService = {
  getAll: (status?: SalesInvoiceStatus): Promise<SalesInvoice[]> =>
    apiGet<SalesInvoice[]>(`/sales-invoices${status ? `?status=${status}` : ''}`),

  getById: (id: string): Promise<SalesInvoice> =>
    apiGet<SalesInvoice>(`/sales-invoices/${id}`),

  create: (data: SalesInvoiceInput): Promise<SalesInvoice> =>
    apiPost<SalesInvoice>('/sales-invoices', data),

  post: (id: string): Promise<SalesInvoice> =>
    apiPost<SalesInvoice>(`/sales-invoices/${id}/post`, {}),

  delete: (id: string): Promise<void> =>
    apiDel<void>(`/sales-invoices/${id}`),
};
