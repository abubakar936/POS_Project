import { apiRequest, encodeQuery } from './client';
import type {
  CategoryOption,
  CompanyOption,
  PageResult,
  StockRecord,
  SubcategoryOption,
  VendorOption,
} from './catalog.types';

const PAGE_SIZE = 100;

async function getAllPages<T>(
  path: string,
  signal?: AbortSignal,
  isActive?: 'true' | 'false',
): Promise<T[]> {
  const firstPage = await apiRequest<PageResult<T>>(
    `${path}${encodeQuery({ page: 1, limit: PAGE_SIZE, isActive })}`,
    { signal },
  );
  const pages = [firstPage];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    pages.push(
      await apiRequest<PageResult<T>>(
        `${path}${encodeQuery({
          page,
          limit: PAGE_SIZE,
          isActive,
        })}`,
        { signal },
      ),
    );
  }
  return pages.flatMap((page) => page.data);
}

export function getActiveCategories(signal?: AbortSignal) {
  return getAllPages<CategoryOption>('/categories', signal, 'true');
}

export function getSubcategories(signal?: AbortSignal) {
  return getAllPages<SubcategoryOption>('/sub-categories', signal);
}

export function getActiveSubcategories(signal?: AbortSignal) {
  return getAllPages<SubcategoryOption>('/sub-categories', signal, 'true');
}

export function getCompanies(signal?: AbortSignal) {
  return getAllPages<CompanyOption>('/companies', signal);
}

export function getVendors(signal?: AbortSignal) {
  return getAllPages<VendorOption>('/vendors', signal);
}

export async function getProductStockRecords(
  productId: string,
  signal?: AbortSignal,
): Promise<StockRecord[]> {
  const allRecords: StockRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiRequest<PageResult<StockRecord>>(
      `/stocks${encodeQuery({ productId, page, limit: PAGE_SIZE })}`,
      { signal },
    );
    allRecords.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page <= totalPages);

  return allRecords;
}

export async function getProductStockTotals(
  productIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const totals = new Map<string, string>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < productIds.length) {
      const currentIndex = cursor;
      cursor += 1;
      const productId = productIds[currentIndex];
      if (!productId) continue;
      const records = await getProductStockRecords(productId, signal);
      totals.set(
        productId,
        records.reduce(
          (total, record) =>
            total + parseQuantityHundredths(record.remainingQuantity),
          0n,
        ).toString(),
      );
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(4, productIds.length) },
      () => worker(),
    ),
  );
  return new Map(
    [...totals].map(([id, hundredths]) => [
      id,
      formatQuantityHundredths(BigInt(hundredths)),
    ]),
  );
}

function parseQuantityHundredths(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
}

function formatQuantityHundredths(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
