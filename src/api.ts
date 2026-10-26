// API client wrapper for Beacon

import { PowerAction, StatusResponse } from './types';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  requiresForce?: boolean;
  playerCount?: number;

  constructor(
    message: string,
    status: number,
    extra: { retryAfter?: number; requiresForce?: boolean; playerCount?: number } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = extra.retryAfter;
    this.requiresForce = extra.requiresForce;
    this.playerCount = extra.playerCount;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (options.method && options.method.toUpperCase() === 'POST') {
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', 'server-control');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Could not reach Beacon. Check your connection.', 0);
  }

  if (response.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, {
      retryAfter: data?.retryAfter ? parseInt(data.retryAfter, 10) : undefined,
      requiresForce: Boolean(data?.requiresForce),
      playerCount: typeof data?.playerCount === 'number' ? data.playerCount : undefined,
    });
  }

  return data as T;
}

export async function getConfig(): Promise<{ turnstileSiteKey: string | null }> {
  try {
    return await apiFetch<{ turnstileSiteKey: string | null }>('/api/config');
  } catch {
    return { turnstileSiteKey: null };
  }
}

// Resolves true when the session cookie is valid; false on 401. Other failures throw.
export async function checkSession(): Promise<boolean> {
  try {
    await apiFetch<{ authenticated: boolean }>('/api/session');
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    throw err;
  }
}

export async function login(password: string, turnstileToken?: string): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password, turnstileToken }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getStatus(): Promise<StatusResponse> {
  return await apiFetch<StatusResponse>('/api/status');
}

export async function sendPowerAction(
  action: PowerAction,
  force?: boolean
): Promise<{ success: boolean; message?: string }> {
  return await apiFetch<{ success: boolean; message?: string }>('/api/power', {
    method: 'POST',
    body: JSON.stringify({ action, force }),
  });
}

// The download itself is a plain link to this URL (see BackupCard): the browser follows the
// stream or redirect natively, so there is no CORS and no buffering of a large file in memory.
export const BACKUP_DOWNLOAD_URL = '/api/backup?download=1';
