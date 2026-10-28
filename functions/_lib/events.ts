// Events and Discord alerts, shared by the dashboard Functions and workers/auto-stop.
//
// Every event is a row in D1 (events table). The same thing can be noticed by several sources (a
// stop from the dashboard, the auto-stop worker, the agent seeing Minecraft go quiet), so each event
// may carry a dedupe key: the insert only happens when no event with that key exists inside the
// window, in one atomic statement. Whatever gets inserted is posted to Discord as one message per
// call, never more than MAX_POSTS_PER_MINUTE across all sources, and never retried.
//
// Messages carry no IP hashes and no tokens. Player names come from an offline-mode server, so
// they are untrusted: control characters stripped, 32 characters at most, Discord markdown escaped,
// and the post sets allowed_mentions to nothing, so "@everyone" in a name pings nobody.

export type EventType =
  | 'server_starting'
  | 'server_restarting'
  | 'server_online'
  | 'server_stopped'
  | 'player_joined'
  | 'player_left'
  | 'backup_failed'
  | 'restore_started'
  | 'restore_finished';

export const EVENT_TYPES: readonly EventType[] = [
  'server_starting',
  'server_restarting',
  'server_online',
  'server_stopped',
  'player_joined',
  'player_left',
  'backup_failed',
  'restore_started',
  'restore_finished',
];

export type EventSource = 'dashboard' | 'auto-stop' | 'agent';

export interface NewEvent {
  type: EventType;
  source: EventSource;
  // Skip this event if one with the same key happened within dedupeWindowMs
  dedupeKey?: string;
  dedupeWindowMs?: number;
  details?: EventDetails;
}

export interface EventDetails {
  name?: string; // player name (untrusted)
  reason?: string; // why it stopped / what failed (from our own code or the agent)
  playedMs?: number; // length of the session that just ended
  address?: string; // join address, only when DISCORD_SHOW_ADDRESS is "true"
  snapshot?: string; // restore: snapshot file name
  ok?: boolean; // restore finished: success or not
}

export interface EventEnv {
  DASH_DB?: D1Database;
  DISCORD_WEBHOOK_URL?: string;
  DISCORD_EVENTS?: string;
}

const MAX_POSTS_PER_MINUTE = 5;
const KEEP_EVENTS_MS = 60 * 24 * 60 * 60 * 1000;
const POST_TIMEOUT_MS = 5000;
const WEBHOOK_PREFIX = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// --- Untrusted text -----------------------------------------------------------------------------

// Control characters, zero-width marks and bidi overrides: invisible in Discord, or used to
// make a name look like something else
function isInvisible(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

// Player names: printable, at most 32 characters, every Discord markdown character escaped
export function safeName(raw: string): string {
  const printable = Array.from(raw)
    .filter((ch) => !isInvisible(ch.codePointAt(0) ?? 0))
    .slice(0, 32)
    .join('');
  return escapeMarkdown(printable.trim() || '(unnamed)');
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[\\*_~`|>#\-[\]()<:@!.]/g, (c) => `\\${c}`);
}

// Free text such as a failure reason: one line, 150 characters, escaped
export function safeText(raw: string, max = 150): string {
  return escapeMarkdown(raw.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, max));
}

// Snapshot file names go inside a code span, where escapes would show; keep only safe characters
function codeName(raw: string | undefined): string {
  return (raw ?? '?').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128) || '?';
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

// --- Configuration ------------------------------------------------------------------------------

// DISCORD_EVENTS: comma-separated event types to post, "all" (the default) or "none"
export function enabledTypes(env: EventEnv): Set<EventType> {
  const raw = (env.DISCORD_EVENTS || 'all').trim().toLowerCase();
  if (raw === 'all' || raw === '') return new Set(EVENT_TYPES);
  if (raw === 'none') return new Set();
  const wanted = raw.split(',').map((s) => s.trim());
  return new Set(EVENT_TYPES.filter((t) => wanted.includes(t)));
}

function webhookUrl(env: EventEnv): string | null {
  const url = env.DISCORD_WEBHOOK_URL?.trim();
  return url && WEBHOOK_PREFIX.test(url) ? url : null;
}

// --- Messages -----------------------------------------------------------------------------------

export function formatEvent(e: NewEvent): string {
  const d = e.details ?? {};
  const name = d.name ? `**${safeName(d.name)}**` : 'Someone';
  switch (e.type) {
    case 'server_starting':
      return '🟡 Server starting (from the dashboard). It should be joinable in about 2 minutes.';
    case 'server_restarting':
      return '🟡 Server restarting (from the dashboard). Back in about 2 minutes.';
    case 'server_online':
      return d.address ? `🟢 Server is online. Join at \`${d.address}\`` : '🟢 Server is online and joinable.';
    case 'server_stopped':
      return `🔴 Server stopped (${safeText(d.reason ?? 'stopped')}).`;
    case 'player_joined':
      return `➕ ${name} joined.`;
    case 'player_left':
      return d.playedMs ? `➖ ${name} left after ${formatDuration(d.playedMs)}.` : `➖ ${name} left.`;
    case 'backup_failed':
      return `⚠️ Backup failed: ${safeText(d.reason ?? 'no reason given')}`;
    case 'restore_started':
      return `♻️ Restore started from snapshot \`${codeName(d.snapshot)}\`. Minecraft stays stopped until someone restarts it.`;
    case 'restore_finished':
      return d.ok
        ? `✅ Restore finished from \`${codeName(d.snapshot)}\`. Use Restart in the dashboard to start the server.`
        : `❌ Restore failed: ${safeText(d.reason ?? 'no reason given')}`;
  }
}

// --- Recording and posting ----------------------------------------------------------------------

async function postToDiscord(url: string, lines: string[]): Promise<'sent' | 'failed'> {
  // One message; Discord's limit is 2,000 characters
  let content = '';
  for (const line of lines) {
    if (content.length + line.length + 1 > 1900) {
      content += '\n…';
      break;
    }
    content += (content ? '\n' : '') + line;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Beacon', content, allowed_mentions: { parse: [] } }),
      signal: controller.signal,
    });
    // 429 included: dropped, not retried. Never log the URL.
    if (!res.ok) console.error(`Discord webhook answered HTTP ${res.status}`);
    return res.ok ? 'sent' : 'failed';
  } catch (err) {
    console.error('Discord webhook unreachable:', err instanceof Error ? err.name : 'error');
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

// Record events (de-duplicated) and post the new ones to Discord. Never throws.
// Callers run it inside waitUntil, so nothing here slows a response.
export async function emitEvents(env: EventEnv, events: NewEvent[], now = Date.now()): Promise<void> {
  if (events.length === 0) return;
  try {
    const url = webhookUrl(env);
    const enabled = enabledTypes(env);
    const db = env.DASH_DB;
    let fresh: Array<{ id: number | null; event: NewEvent }> = events.map((event) => ({ id: null, event }));

    if (db) {
      const results = await db.batch(
        events.map((e) =>
          db
            .prepare(
              `INSERT INTO events (type, created_at, source, dedupe_key, details, discord)
               SELECT ?1, ?2, ?3, ?4, ?5, ?6
               WHERE NOT EXISTS (SELECT 1 FROM events WHERE dedupe_key = ?4 AND created_at > ?7)
               RETURNING id`
            )
            .bind(
              e.type,
              now,
              e.source,
              e.dedupeKey ?? null,
              JSON.stringify(e.details ?? {}),
              url && enabled.has(e.type) ? 'queued' : 'off',
              now - (e.dedupeWindowMs ?? 0)
            )
        )
      );
      fresh = results.flatMap((r, i) => {
        const row = r.results[0] as { id: number } | undefined;
        return row ? [{ id: row.id, event: events[i] }] : [];
      });
    }

    const toPost = fresh.filter((f) => url && enabled.has(f.event.type));
    if (!url || toPost.length === 0) return;

    // Global brake: a few posts a minute at most, whoever sends them
    if (db) {
      const recent = await db
        .prepare(`SELECT count(DISTINCT created_at) AS n FROM events WHERE discord = 'sent' AND created_at > ?1`)
        .bind(now - 60_000)
        .first<{ n: number }>();
      if ((recent?.n ?? 0) >= MAX_POSTS_PER_MINUTE) {
        await markDiscord(db, toPost, 'limited', now);
        return;
      }
    }

    const status = await postToDiscord(url, toPost.map((f) => formatEvent(f.event)));
    if (db) await markDiscord(db, toPost, status, now);
  } catch (err) {
    console.error('Recording events failed:', err instanceof Error ? err.message : err);
  }
}

async function markDiscord(
  db: D1Database,
  posted: Array<{ id: number | null }>,
  status: string,
  now: number
): Promise<void> {
  const ids = posted.map((p) => p.id).filter((id): id is number => id !== null);
  if (ids.length === 0) return;
  await db.batch([
    db.prepare(`UPDATE events SET discord = ?1 WHERE id IN (${ids.map(() => '?').join(',')})`).bind(status, ...ids),
    // Housekeeping rides along with the occasional post
    db.prepare('DELETE FROM events WHERE created_at < ?1').bind(now - KEEP_EVENTS_MS),
  ]);
}
