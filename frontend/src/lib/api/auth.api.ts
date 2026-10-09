import { apiRequest, ACCESS_TOKEN_STORAGE_KEY } from './client';

interface LoginResponse {
  access_token: string;
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
