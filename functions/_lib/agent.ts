// Authentication and limits for the /api/agent/* routes called by mc-agent.sh on arm-free.
// These routes skip the session cookie and CSRF checks (curl has neither) and use a bearer
// token instead: AGENT_TOKEN, compared in constant time.

import { getMaskedActor, timingSafeEqual } from './auth';
import { bumpRate, ensureSchema, isAgentConfigured, readRate } from './backupjob';
import { Env } from './types';

export const AGENT_API_PATHS = new Set(['/api/agent/poll', '/api/agent/report']);
export const AGENT_MAX_BODY_BYTES = 1024;

// Successful calls: the agent polls once a minute and reports a few times an hour
const REQUESTS_PER_MINUTE = 10;
// Wrong tokens: 10 per IP locks that IP out for 15 minutes. Past 50 across all IPs in the
// window, failures stop being recorded (so a flood cannot burn D1 writes) but are still refused.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAILS_PER_IP = 10;
const FAILS_GLOBAL = 50;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

// Hashing both sides first gives equal-length inputs, so the comparison leaks neither the
// token's contents nor its length
async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  return timingSafeEqual(a, b);
}

// Returns a response to send instead of the route, or null to let the request through
export async function guardAgentRequest(request: Request, env: Env, path: string): Promise<Response | null> {
  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    return json({ error: 'Unsupported Media Type: Expected application/json' }, 415);
  }
  if (!isAgentConfigured(env)) {
    return json({ error: 'The backup agent is not set up on this Beacon.' }, 503);
  }

  const db = env.AGENT_DB;
  try {
    await ensureSchema(db);
  } catch (err) {
    console.error('Agent DB unavailable:', err instanceof Error ? err.message : err);
    return json({ error: 'Agent storage unavailable' }, 503);
  }

  const ipHash = await getMaskedActor(request.headers.get('CF-Connecting-IP') || '127.0.0.1');
  const failKey = `fail:${ipHash}`;

  if ((await readRate(db, failKey, FAIL_WINDOW_MS)) >= FAILS_PER_IP) {
    return json({ error: 'Too many failed attempts. Try again later.' }, 429, { 'Retry-After': '900' });
  }

  const header = request.headers.get('Authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!provided || !(await tokenMatches(provided, env.AGENT_TOKEN))) {
    if ((await readRate(db, 'fail:all', FAIL_WINDOW_MS)) < FAILS_GLOBAL) {
      await Promise.all([bumpRate(db, failKey, FAIL_WINDOW_MS), bumpRate(db, 'fail:all', FAIL_WINDOW_MS)]);
    }
    return json({ error: 'Unauthorized' }, 401);
  }

  if ((await bumpRate(db, `req:${path}`, 60 * 1000)) > REQUESTS_PER_MINUTE) {
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' });
  }

  return null;
}

// Read a JSON object body, refusing anything over the cap even when Content-Length is missing
export async function readAgentJson(request: Request): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > AGENT_MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// --- Field validation: anything malformed becomes null rather than an error ---------------------

const EARLIEST = Date.UTC(2020, 0, 1);

export function parseTime(v: unknown): number | null {
  if (typeof v !== 'string' || v.length > 40) return null;
  const t = Date.parse(v);
  // Allow a little clock skew, nothing from the future beyond that
  if (isNaN(t) || t < EARLIEST || t > Date.now() + 5 * 60 * 1000) return null;
  return t;
}

export function parseBytes(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < 1e13 ? v : null;
}

export function parseBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

// Short, single-line, printable: it ends up on the dashboard and in the activity log
export function parseMessage(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const clean = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200);
  return clean || null;
}
