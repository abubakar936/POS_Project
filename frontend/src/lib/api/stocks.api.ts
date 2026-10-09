import { apiRequest, encodeQuery } from './client';
import type { PageResult, StockRecord } from './catalog.types';
import type { Product } from './products.types';

const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 4;

export interface InventoryStockRecord extends StockRecord {
  product?: Product | null;
  createdAt: string;
  purchaseDate?: string | null;
  totalPurchaseValue?: string | null;
}

export interface CreateStockPayload {
  productId: string;
  quantity: string;
  minimumQuantity?: string;
  locationType: string;
  rackLocation?: string;
  purchasePrice: string;
  salePrice: string;
  printedPrice?: string;
  totalPurchaseValue?: string;
  purchaseDate?: string;
  vendorId?: string;
  companyId?: string;
}

async function getAllPages<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const first = await apiRequest<PageResult<T>>(
    `${path}${encodeQuery({ page: 1, limit: PAGE_SIZE })}`,
    { signal },
  );
  const pages: PageResult<T>[] = [first];
  let nextPage = 2;

  async function worker() {
    while (nextPage <= first.meta.totalPages) {
      const page = nextPage;
      nextPage += 1;
      pages.push(
        await apiRequest<PageResult<T>>(
          `${path}${encodeQuery({ page, limit: PAGE_SIZE })}`,
          { signal },
        ),
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(PAGE_CONCURRENCY, first.meta.totalPages - 1) },
      () => worker(),
    ),
  );
  return pages
    .sort((left, right) => left.meta.page - right.meta.page)
    .flatMap((result) => result.data);
}

export function listInventoryStocks(signal?: AbortSignal) {
  return getAllPages<InventoryStockRecord>('/stocks', signal);
}

export function listInventoryProducts(signal?: AbortSignal) {
  return getAllPages<Product>('/products', signal);
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
