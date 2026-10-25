// API client wrapper for Beacon

import { StatusResponse } from './types';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  requiresForce?: boolean;

  constructor(message: string, status: number, retryAfter?: number, requiresForce?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.requiresForce = requiresForce;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (options.method && options.method.toUpperCase() === 'POST') {
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', 'server-control');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

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
    const retryAfter = data?.retryAfter ? parseInt(data.retryAfter, 10) : undefined;
    const requiresForce = Boolean(data?.requiresForce);
    throw new ApiError(errorMsg, response.status, retryAfter, requiresForce);
  }

  return data as T;
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
  return await apiFetch<StatusResponse>('/api/status', {
    method: 'GET',
  });
}

export async function sendPowerAction(
  action: 'start' | 'stop' | 'restart',
  force?: boolean
): Promise<{ success: boolean; message?: string }> {
  return await apiFetch<{ success: boolean; message?: string }>('/api/power', {
    method: 'POST',
    body: JSON.stringify({ action, force }),
  });
}

export async function downloadBackup(): Promise<void> {
  // 1. Verify status endpoint first
  const check = await fetch('/api/backup', { credentials: 'same-origin' });
  const data = await check.json().catch(() => null);
  if (!check.ok || !data?.available) {
    throw new ApiError(data?.message || data?.error || 'Backup is currently unavailable', check.status);
  }

  // 2. Trigger native browser file download (follows 302 redirect to Oracle without CORS restrictions)
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = '/api/backup?download=1';
  a.setAttribute('download', 'minecraft-world-latest.tar.gz');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 1000);
}
