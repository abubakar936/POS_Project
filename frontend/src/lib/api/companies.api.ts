import { apiRequest } from './client';
import type { CompanyOption } from './catalog.types';

export interface CompanyPayload {
  name: string;
}

export function createCompany(payload: CompanyPayload) {
  return apiRequest<CompanyOption>('/companies', {
    method: 'POST',
    body: payload,
  });
}
