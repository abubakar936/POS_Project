const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = (configuredBaseUrl || '/api').replace(/\/+$/, '');
export const ACCESS_TOKEN_STORAGE_KEY = 'pos_access_token';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(' '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

async function parseErrorMessages(response: Response): Promise<string[]> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return [`Request failed (${response.status} ${response.statusText}).`];
  }

  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return [`Request failed (${response.status} ${response.statusText}).`];
  }

  const message = body.message;
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) {
    return message.filter((entry): entry is string => typeof entry === 'string');
  }
  return [`Request failed (${response.status} ${response.statusText}).`];
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const token = readAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessages(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function encodeQuery(
  values: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
