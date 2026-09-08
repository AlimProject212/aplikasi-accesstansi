import { apiFetch } from './api';
import { FundRequest } from '../../types';

export const fundRequestsService = {
  /** Ambil semua fund requests */
  getAll: (): Promise<FundRequest[]> =>
    apiFetch<FundRequest[]>('/api/fund-requests'),

  /** Buat pengajuan baru */
  create: (data: {
    employeeId:      string;
    employeeName:    string;
    employeeRole?:   string;
    date:            string;
    purpose:         string;
    amountRequested: number;
  }): Promise<FundRequest> =>
    apiFetch<FundRequest>('/api/fund-requests', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),

  /** Setujui pengajuan + posting jurnal */
  approve: (
    id:              string,
    debitAccountId:  string,
    creditAccountId: string
  ): Promise<FundRequest> =>
    apiFetch<FundRequest>(`/api/fund-requests/${id}/approve`, {
      method: 'PATCH',
      body:   JSON.stringify({ debitAccountId, creditAccountId }),
    }),

  /** Tolak pengajuan */
  reject: (id: string, rejectionReason: string): Promise<FundRequest> =>
    apiFetch<FundRequest>(`/api/fund-requests/${id}/reject`, {
      method: 'PATCH',
      body:   JSON.stringify({ rejectionReason }),
    }),

  /** Posting realisasi dana */
  realize: (
    id:   string,
    data: {
      actualAmount:     number;
      expenseLines:     { accountId: string; amount: number }[];
      refundAccountId?: string;
      notes?:           string;
    }
  ): Promise<FundRequest> =>
    apiFetch<FundRequest>(`/api/fund-requests/${id}/realize`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    }),
};
