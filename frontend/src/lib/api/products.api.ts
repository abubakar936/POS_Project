import { apiRequest, encodeQuery } from './client';
import type { PageResult } from './catalog.types';
import type { Product, ProductListQuery, ProductPayload } from './products.types';

export function listProducts(
  query: ProductListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PageResult<Product>>(
    `/products${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    })}`,
    { signal },
  );
}

export async function listAllActiveProducts(signal?: AbortSignal) {
  const pageSize = 100;
  const first = await listProducts(
    { page: 1, limit: pageSize, isActive: 'true' },
    signal,
  );
  const products = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const result = await listProducts(
      { page, limit: pageSize, isActive: 'true' },
      signal,
    );
    products.push(...result.data);
  }
  return products;
}

export function getProduct(id: string, signal?: AbortSignal) {
  return apiRequest<Product>(`/products/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createProduct(payload: ProductPayload) {
  return apiRequest<Product>('/products', { method: 'POST', body: payload });
}

export function updateProduct(id: string, payload: Partial<ProductPayload>) {
  return apiRequest<Product>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteProduct(id: string) {
  return apiRequest<{ success: boolean }>(
    `/products/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
