import { apiRequest, encodeQuery } from './client';
import type { PageResult } from './catalog.types';

export interface CustomerRecord {
  id: string;
  customer_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  customer_type?: string | null;
  opening_balance: string;
  current_balance: string;
  status?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CustomerQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface CustomerPayload {
  customer_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  customer_type?: string | null;
  status?: string | null;
  notes?: string | null;
}

export function listCustomers(query: CustomerQuery, signal?: AbortSignal) {
  return apiRequest<PageResult<CustomerRecord>>(
    `/customers${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
    })}`,
    { signal },
  );
}

export function getCustomer(id: string, signal?: AbortSignal) {
  return apiRequest<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createCustomer(payload: CustomerPayload) {
  return apiRequest<CustomerRecord>('/customers', {
    method: 'POST',
    body: payload,
  });
}

export function updateCustomer(id: string, payload: CustomerPayload) {
  return apiRequest<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteCustomer(id: string) {
  return apiRequest<{ success?: boolean; affected?: number }>(
    `/customers/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
