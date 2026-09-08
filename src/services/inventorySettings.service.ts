import { apiGet, apiPut } from './api';
import { InventorySettings } from '../../types';

export const inventorySettingsService = {
  get: (): Promise<InventorySettings> =>
    apiGet<InventorySettings>('/inventory-settings'),

  update: (data: Partial<Omit<InventorySettings, 'id'>>): Promise<InventorySettings> =>
    apiPut<InventorySettings>('/inventory-settings', data),
};
