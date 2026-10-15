import { apiRequest, encodeQuery } from './client';
import type { PageResult } from './catalog.types';

export interface VendorRecord {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  address1?: string | null;
  address2?: string | null;
  reference?: string | null;
  note?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface VendorQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface VendorPayload {
  name: string;
  companyName?: string;
  email?: string;
  phone1?: string;
  phone2?: string;
  address1?: string;
  address2?: string;
  reference?: string;
  note?: string;
  description?: string;
  isActive?: boolean;
}

export function listVendors(query: VendorQuery, signal?: AbortSignal) {
  return apiRequest<PageResult<VendorRecord>>(
    `/vendors${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    })}`,
    { signal },
  );
}

export function getVendor(id: string, signal?: AbortSignal) {
  return apiRequest<VendorRecord>(`/vendors/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createVendor(payload: VendorPayload) {
  return apiRequest<VendorRecord>('/vendors', { method: 'POST', body: payload });
}

export function updateVendor(id: string, payload: Partial<VendorPayload>) {
  return apiRequest<VendorRecord>(`/vendors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteVendor(id: string) {
  return apiRequest<{ success: boolean }>(
    `/vendors/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
