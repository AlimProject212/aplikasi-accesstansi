import { apiGet } from './api';
import { Product, StockLedgerEntry } from '../../types';

export interface StockCardResponse {
  product: Product;
  entries: StockLedgerEntry[];
}

export interface ValuationItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string | null;
  currentStock: number;
  avgCost: number;
  value: number;
}

export interface ValuationResponse {
  items: ValuationItem[];
  totalValue: number;
}

export interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string | null;
  currentStock: number;
  minStock: number;
  avgCost: number;
}

export interface GrossMarginItem {
  productId: string;
  sku: string;
  name: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  marginPercent: number;
}

export interface GrossMarginResponse {
  items: GrossMarginItem[];
  totals: { revenue: number; cogs: number; grossMargin: number };
}

export const inventoryService = {
  getStockCard: (productId: string, params?: { from?: string; to?: string }): Promise<StockCardResponse> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString();
    return apiGet<StockCardResponse>(`/inventory/stock-card/${productId}${query ? `?${query}` : ''}`);
  },

  getValuation: (): Promise<ValuationResponse> =>
    apiGet<ValuationResponse>('/inventory/valuation'),

  getLowStock: (): Promise<LowStockItem[]> =>
    apiGet<LowStockItem[]>('/inventory/low-stock'),

  getGrossMargin: (params?: { from?: string; to?: string }): Promise<GrossMarginResponse> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString();
    return apiGet<GrossMarginResponse>(`/inventory/gross-margin${query ? `?${query}` : ''}`);
  },
};
