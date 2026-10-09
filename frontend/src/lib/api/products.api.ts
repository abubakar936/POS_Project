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
