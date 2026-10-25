// Cloudflare Pages Functions Middleware
// Enforces security headers, CSRF protection, input body limits, and authentication.

import { getSessionCookie, verifySessionToken } from './_lib/auth';
import { Env } from './_lib/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Apply to API routes
  if (path.startsWith('/api/')) {
    // 1. Method validation
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'GET, POST',
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2. Request body size check (reject bodies over 1 KB)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1024) {
      return new Response(JSON.stringify({ error: 'Payload Too Large: Body must be under 1 KB' }), {
        status: 413,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }

    // 3. CSRF Protection for all POST requests
    if (request.method === 'POST') {
      const origin = request.headers.get('Origin');
      const reqWith = request.headers.get('X-Requested-With');
      const contentType = request.headers.get('Content-Type') || '';

      // Verify Origin matches request origin
      if (!origin || origin !== url.origin) {
        return new Response(JSON.stringify({ error: 'Forbidden: Origin validation failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      // Verify custom X-Requested-With header
      if (reqWith !== 'server-control') {
        return new Response(JSON.stringify({ error: 'Forbidden: Missing or invalid security header' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      // Verify Content-Type is application/json
      if (!contentType.toLowerCase().includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Unsupported Media Type: Expected application/json' }), {
          status: 415,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }

    // 4. Authentication enforcement on all /api/* routes except /api/login
    if (path !== '/api/login') {
      const token = getSessionCookie(request);
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Session missing' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      const session = await verifySessionToken(token, env.SESSION_SECRET);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }
  }

  // Proceed to route handler or static asset
  const response = await next();

  // Clone headers to inject mandatory security headers
  const newHeaders = new Headers(response.headers);

  // Strict CSP: No inline scripts, no inline styles, no external font/cdn connections.
  // When Turnstile is configured, allow challenges.cloudflare.com for script, frame, and connect.
  const hasTurnstile = Boolean(env.TURNSTILE_SECRET || env.TURNSTILE_SITEKEY);
  const csp = hasTurnstile
    ? "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

  newHeaders.set('Content-Security-Policy', csp);
  newHeaders.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('Referrer-Policy', 'no-referrer');
  newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (path.startsWith('/api/')) {
    newHeaders.set('Cache-Control', 'no-store');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
