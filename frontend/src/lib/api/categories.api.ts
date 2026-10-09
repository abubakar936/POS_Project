import { apiRequest, encodeQuery } from './client';
import type { PageResult } from './catalog.types';
import type { CategoryOption } from './catalog.types';

export interface Category extends CategoryOption {
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CategoryQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface CategoryPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export function listCategories(query: CategoryQuery, signal?: AbortSignal) {
  return apiRequest<PageResult<Category>>(
    `/categories${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    })}`,
    { signal },
  );
}

export function getCategory(id: string, signal?: AbortSignal) {
  return apiRequest<Category>(`/categories/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createCategory(payload: CategoryPayload) {
  return apiRequest<Category>('/categories', {
    method: 'POST',
    body: payload,
  });
}

export function updateCategory(id: string, payload: Partial<CategoryPayload>) {
  return apiRequest<Category>(`/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}
