import { apiGet, apiPost, apiPut, apiDel } from './api';
import { Unit } from '../../types';

export const unitsService = {
  getAll: (): Promise<Unit[]> =>
    apiGet<Unit[]>('/units'),

  create: (name: string, abbreviation: string): Promise<Unit> =>
    apiPost<Unit>('/units', { name, abbreviation }),

  update: (id: number, name: string, abbreviation: string): Promise<Unit> =>
    apiPut<Unit>(`/units/${id}`, { name, abbreviation }),

  delete: (id: number): Promise<void> =>
    apiDel<void>(`/units/${id}`),
};
