import { apiRequest, ACCESS_TOKEN_STORAGE_KEY } from './client';

export type UserRole = 'admin' | 'user';

interface LoginResponse {
  access_token: string;
}

export interface CurrentUserProfile {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!response.access_token) {
    throw new Error('The server did not return an access token.');
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
}

export function getCurrentUserProfile(signal?: AbortSignal) {
  return apiRequest<CurrentUserProfile>('/auth/profile', { signal });
}
