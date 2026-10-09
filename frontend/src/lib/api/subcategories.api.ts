import { apiRequest, encodeQuery } from './client';
import type { PageResult, SubcategoryOption } from './catalog.types';

export interface Subcategory extends SubcategoryOption {
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SubcategoryQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface SubcategoryPayload {
  name: string;
  description?: string;
  categoryId: string;
  isActive?: boolean;
}

export function listSubcategories(
  query: SubcategoryQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PageResult<Subcategory>>(
    `/sub-categories${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    })}`,
    { signal },
  );
}

export async function listAllSubcategories(
  query: Omit<SubcategoryQuery, 'page' | 'limit'>,
  signal?: AbortSignal,
): Promise<Subcategory[]> {
  const limit = 100;
  const firstPage = await listSubcategories(
    { ...query, page: 1, limit },
    signal,
  );
  const records = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const result = await listSubcategories(
      { ...query, page, limit },
      signal,
    );
    records.push(...result.data);
  }
  return records;
}

export function getSubcategory(id: string, signal?: AbortSignal) {
  return apiRequest<Subcategory>(
    `/sub-categories/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createSubcategory(payload: SubcategoryPayload) {
  return apiRequest<Subcategory>('/sub-categories', {
    method: 'POST',
    body: payload,
  });
}

export function updateSubcategory(
  id: string,
  payload: Partial<SubcategoryPayload>,
) {
  return apiRequest<Subcategory>(
    `/sub-categories/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteSubcategory(id: string) {
  return apiRequest<{ success: boolean }>(
    `/sub-categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
