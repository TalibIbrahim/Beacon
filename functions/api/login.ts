// POST /api/login - Authenticate with shared password

import {
  buildSetCookieHeader,
  createSessionToken,
  dummyVerifyPassword,
  getMaskedActor,
  verifyPassword,
} from '../_lib/auth';
import { addActivityLog } from '../_lib/log';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from '../_lib/ratelimit';
import { Env } from '../_lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

  try {
    // 0. Environment integrity check
    if (!env.DASH_KV) {
      return new Response(
        JSON.stringify({
          error: "KV storage is not connected. In Cloudflare Settings -> Bindings, add a KV namespace binding named 'DASH_KV' pointing to 'beacon-kv'.",
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!env.PASSWORD_HASH || !env.SESSION_SECRET) {
      return new Response(
        JSON.stringify({
          error: 'Missing PASSWORD_HASH or SESSION_SECRET in Cloudflare environment variables.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const turnstileToken = typeof (body as any).turnstileToken === 'string' ? (body as any).turnstileToken : '';

  // Optional Turnstile verification (if TURNSTILE_SECRET configured)
  if (env.TURNSTILE_SECRET) {
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ error: 'Security verification required.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const verifyFormData = new URLSearchParams();
      verifyFormData.append('secret', env.TURNSTILE_SECRET);
      verifyFormData.append('response', turnstileToken);
      verifyFormData.append('remoteip', clientIp);

      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: verifyFormData,
        }
      );

      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        return new Response(
          JSON.stringify({ error: 'Security verification failed. Please retry.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Security verification error. Please retry.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 1. Check rate limits (IP and global)
  const rateStatus = await checkLoginRateLimit(env.DASH_KV, clientIp);
  if (rateStatus.isLocked) {
    // Constant timing mitigation: run dummy PBKDF2 calculation so timing does not leak lockout status
    await dummyVerifyPassword(password);
    return new Response(
      JSON.stringify({
        error: 'Too many failed login attempts. Please wait before retrying.',
        retryAfter: rateStatus.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateStatus.retryAfter.toString(),
        },
      }
    );
  }

  // 2. Validate password against stored hash
  const isValid = await verifyPassword(password, env.PASSWORD_HASH);

  if (!isValid) {
    // Record failed attempt and compute new lock status if threshold reached
    const failStatus = await recordFailedLogin(env.DASH_KV, clientIp);
    const masked = await getMaskedActor(clientIp);

    await addActivityLog(env.DASH_KV, {
      action: 'FAILED_LOGIN',
      result: 'FAILED',
      actor: masked,
    });

    // 800 ms delay on failure as required
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (failStatus.isLocked) {
      return new Response(
        JSON.stringify({
          error: 'Too many failed login attempts. Account temporarily locked.',
          retryAfter: failStatus.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': failStatus.retryAfter.toString(),
          },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Password is valid: reset rate limit counter
  await resetLoginRateLimit(env.DASH_KV, clientIp);

  const masked = await getMaskedActor(clientIp);
  await addActivityLog(env.DASH_KV, {
    action: 'LOGIN',
    result: 'SUCCESS',
    actor: masked,
  });

  // 4. Create signed session token and return Set-Cookie
  const token = await createSessionToken(env.SESSION_SECRET);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSetCookieHeader(token),
    },
  });
  } catch (err: any) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Login failed due to an unexpected internal error.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
