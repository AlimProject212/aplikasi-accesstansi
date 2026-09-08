import { apiGet, apiPost } from './api';
import { POSShift } from '../../types';

export const posShiftsService = {
  getCurrent: (): Promise<POSShift | null> =>
    apiGet<POSShift | null>('/pos/shifts/current'),

  getAll: (): Promise<POSShift[]> =>
    apiGet<POSShift[]>('/pos/shifts'),

  open: (warehouseId: number | undefined, openingCash: number): Promise<POSShift> =>
    apiPost<POSShift>('/pos/shifts', { warehouseId, openingCash }),

  close: (id: string, closingCash: number): Promise<POSShift> =>
    apiPost<POSShift>(`/pos/shifts/${id}/close`, { closingCash }),
};
