import { apiRequest, encodeQuery } from './client';
import type { PageResult, StockRecord } from './catalog.types';
import type { Product } from './products.types';

export interface InventoryStockRecord extends StockRecord {
  product?: Product | null;
  createdAt: string;
  purchaseDate?: string | null;
  totalPurchaseValue?: string | null;
}

export interface StockListQuery {
  search?: string;
  categoryId?: string;
  productIds?: string;
}

export interface UpdateStockPayload {
  productId?: string;
  minimumQuantity?: string | null;
  locationType?: string;
  rackLocation?: string | null;
  printedPrice?: string | null;
  totalPurchaseValue?: string | null;
  purchaseDate?: string | null;
  vendorId?: string | null;
  companyId?: string | null;
}

export interface CreateStockPayload {
  productId: string;
  quantity: string;
  minimumQuantity?: string;
  locationType?: string;
  rackLocation?: string;
  purchasePrice: string;
  salePrice: string;
  printedPrice?: string;
  totalPurchaseValue?: string;
  purchaseDate?: string;
  vendorId?: string;
  companyId?: string;
}

export function listVendorStockRecords(
  vendorId: string,
  page: number,
  limit: number,
  signal?: AbortSignal,
) {
  return apiRequest<PageResult<InventoryStockRecord>>(
    `/stocks${encodeQuery({ vendorId, page, limit })}`,
    { signal },
  );
}

export function listInventoryStocks(
  page: number,
  limit: number,
  signal?: AbortSignal,
  query: StockListQuery = {},
) {
  return apiRequest<PageResult<InventoryStockRecord>>(
    `/stocks${encodeQuery({ ...query, page, limit })}`,
    { signal },
  );
}

export async function listStocksForProducts(
  productIds: string[],
  signal?: AbortSignal,
) {
  if (productIds.length === 0) return [];
  const first = await apiRequest<PageResult<InventoryStockRecord>>(
    `/stocks${encodeQuery({ productIds: productIds.join(','), page: 1, limit: 100 })}`,
    { signal },
  );
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const result = await apiRequest<PageResult<InventoryStockRecord>>(
      `/stocks${encodeQuery({ productIds: productIds.join(','), page, limit: 100 })}`,
      { signal },
    );
    rows.push(...result.data);
  }
  return rows;
}

export function createStock(payload: CreateStockPayload) {
  return apiRequest<InventoryStockRecord>('/stocks', {
    method: 'POST',
    body: payload,
  });
}

export function updateStockSalePrice(id: string, salePrice: string) {
  return apiRequest<InventoryStockRecord>(
    `/stocks/${encodeURIComponent(id)}/sale-price`,
    {
      method: 'PATCH',
      body: { salePrice },
    },
  );
}

export function updateStock(id: string, payload: UpdateStockPayload) {
  return apiRequest<InventoryStockRecord>(`/stocks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}
