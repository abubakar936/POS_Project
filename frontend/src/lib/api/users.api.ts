import { apiRequest } from './client';
import type { UserRole } from './auth.api';

export interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export function listUsers(signal?: AbortSignal) {
  return apiRequest<UserRecord[]>('/users', { signal });
}
