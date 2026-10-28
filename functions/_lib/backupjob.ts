// Backup jobs run by the agent on arm-free, stored in D1 (binding DASH_DB, schema in migrations/).
//
// The agent pulls: every minute it POSTs a heartbeat to /api/agent/poll and gets back
// { backup: true } at most once per "Backup now". D1 rather than KV because the heartbeat is a
// write every minute (KV's free plan allows 1,000 writes a day) and because handing a request
// to the agent must happen exactly once (KV writes take up to a minute to reach other locations).
//
// Every table here holds a single row (id = 1) except agent_rate. The heartbeat row itself is
// written by snapshot.ts.

import { BackupJobInfo, BackupRequestState, BackupTrigger, Env, VmState } from './types';

export const HEARTBEAT_STALE_MS = 3 * 60 * 1000;
export const REQUEST_COOLDOWN_MS = 5 * 60 * 1000;
// A request nobody picked up, or a run that never reported back, counts as failed after this
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;
const RUNNING_TIMEOUT_MS = 60 * 60 * 1000;
const OVERDUE_MS = 90 * 60 * 1000;

export function isAgentConfigured(env: Env): env is Env & { DASH_DB: D1Database; AGENT_TOKEN: string } {
  return Boolean(env.DASH_DB && env.AGENT_TOKEN && env.AGENT_TOKEN.length >= 32);
}

// --- Rate limits (fixed windows, global per key) ---------------------------------------------

// Adds one to the counter for this window and returns the new count
export async function bumpRate(db: D1Database, key: string, windowMs: number): Promise<number> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const row = await db
    .prepare(
      `INSERT INTO agent_rate (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN agent_rate.window_start = excluded.window_start THEN agent_rate.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

export async function readRate(db: D1Database, key: string, windowMs: number): Promise<number> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const row = await db
    .prepare('SELECT count FROM agent_rate WHERE key = ?1 AND window_start = ?2')
    .bind(key, windowStart)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

// --- Agent side --------------------------------------------------------------------------------

export interface RunReport {
  trigger: BackupTrigger;
  ok: boolean;
  finishedAt: number; // epoch ms
  sizeBytes: number | null;
  error: string | null;
}

// Record a finished run. Returns true when it closed the dashboard's "Backup now" request.
// A successful run also moves the heartbeat's last backup time and size forward right away, so the
// dashboard does not wait for the next poll (and shows the real finish time, not when the copy began).
// The request update stays at index 1 of the batch.
export async function recordRunReport(db: D1Database, report: RunReport): Promise<boolean> {
  const statements = [
    db
      .prepare(
        `INSERT INTO backup_last_run (id, trigger, ok, finished_at, size_bytes, error)
         VALUES (1, ?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           trigger = excluded.trigger, ok = excluded.ok, finished_at = excluded.finished_at,
           size_bytes = excluded.size_bytes, error = excluded.error`
      )
      .bind(report.trigger, report.ok ? 1 : 0, report.finishedAt, report.sizeBytes, report.error),
  ];
  if (report.trigger === 'requested') {
    statements.push(
      db
        .prepare(
          `UPDATE backup_request SET state = ?1, finished_at = ?2, size_bytes = ?3, error = ?4
           WHERE id = 1 AND state = 'running'`
        )
        .bind(report.ok ? 'done' : 'failed', report.finishedAt, report.sizeBytes, report.error)
    );
  }
  if (report.ok) {
    statements.push(
      db
        .prepare(
          `UPDATE agent_heartbeat SET
             last_success = MAX(COALESCE(last_success, 0), ?1),
             archive_bytes = COALESCE(?2, archive_bytes)
           WHERE id = 1`
        )
        .bind(report.finishedAt, report.sizeBytes)
    );
  }
  const results = await db.batch(statements);
  return report.trigger === 'requested' && (results[1]?.meta.changes ?? 0) === 1;
}

// --- Dashboard side ----------------------------------------------------------------------------

interface RequestRow {
  state: BackupRequestState;
  requested_at: number;
  started_at: number | null;
  finished_at: number | null;
  size_bytes: number | null;
  error: string | null;
}

export type CreateRequestResult =
  | { ok: true }
  | { ok: false; reason: 'busy'; state: BackupRequestState }
  | { ok: false; reason: 'cooldown'; retryAfter: number };

// One request at a time, and at most one every REQUEST_COOLDOWN_MS. The conditional upsert makes
// the check and the write a single statement, so two clicks at once cannot both get through.
export async function createBackupRequest(db: D1Database): Promise<CreateRequestResult> {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO backup_request (id, state, requested_at) VALUES (1, 'pending', ?1)
       ON CONFLICT(id) DO UPDATE SET
         state = 'pending', requested_at = excluded.requested_at,
         started_at = NULL, finished_at = NULL, size_bytes = NULL, error = NULL
       WHERE backup_request.requested_at <= ?2
         AND NOT (backup_request.state = 'pending' AND backup_request.requested_at > ?3)
         AND NOT (backup_request.state = 'running' AND backup_request.started_at > ?4)`
    )
    .bind(now, now - REQUEST_COOLDOWN_MS, now - PENDING_TIMEOUT_MS, now - RUNNING_TIMEOUT_MS)
    .run();

  if ((result.meta.changes ?? 0) === 1) return { ok: true };

  const row = await db.prepare('SELECT * FROM backup_request WHERE id = 1').first<RequestRow>();
  const state = row ? effectiveState(row, now).state : 'done';
  if (state === 'pending' || state === 'running') return { ok: false, reason: 'busy', state };
  const retryAfter = row ? Math.max(1, Math.ceil((row.requested_at + REQUEST_COOLDOWN_MS - now) / 1000)) : 1;
  return { ok: false, reason: 'cooldown', retryAfter };
}

// Requests that were never picked up, or never reported back, read as failed
function effectiveState(row: RequestRow, now: number): { state: BackupRequestState; error: string | null } {
  if (row.state === 'pending' && row.requested_at <= now - PENDING_TIMEOUT_MS) {
    return { state: 'failed', error: 'arm-free did not pick up the request within 10 minutes.' };
  }
  if (row.state === 'running' && (row.started_at ?? 0) <= now - RUNNING_TIMEOUT_MS) {
    return { state: 'failed', error: 'No result from arm-free within an hour.' };
  }
  return { state: row.state, error: row.error };
}

const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : undefined);

const EMPTY_AGENT: BackupJobInfo['agent'] = {
  lastSeen: null,
  responding: false,
  busy: false,
  cronActive: null,
  scheduleInstalled: null,
};

export async function getBackupJobInfo(
  env: Env,
  ctx: { vmState: VmState; onlineSince: string | null }
): Promise<BackupJobInfo> {
  if (!isAgentConfigured(env)) {
    const missing = [!env.DASH_DB && 'the DASH_DB D1 binding', !(env.AGENT_TOKEN && env.AGENT_TOKEN.length >= 32) && 'AGENT_TOKEN (32+ characters)']
      .filter(Boolean)
      .join(' and ');
    return {
      configured: false,
      message: `Backups from arm-free are not set up: add ${missing}. See the README, "Backups from arm-free".`,
      agent: EMPTY_AGENT,
      lastBackupAt: null,
      lastBackupBytes: null,
      lastRun: null,
      request: null,
      cooldownSeconds: 0,
      overdue: false,
    };
  }

  const db = env.DASH_DB;
  const [hbResult, reqResult, runResult] = await db.batch([
    db.prepare('SELECT * FROM agent_heartbeat WHERE id = 1'),
    db.prepare('SELECT * FROM backup_request WHERE id = 1'),
    db.prepare('SELECT * FROM backup_last_run WHERE id = 1'),
  ]);
  const hb = hbResult.results[0] as
    | { seen_at: number; last_success: number | null; archive_bytes: number | null; busy: number; cron_active: number | null; schedule_installed: number | null }
    | undefined;
  const req = reqResult.results[0] as RequestRow | undefined;
  const run = runResult.results[0] as
    | { trigger: BackupTrigger; ok: number; finished_at: number; size_bytes: number | null; error: string | null }
    | undefined;

  const now = Date.now();
  const responding = Boolean(hb && now - hb.seen_at < HEARTBEAT_STALE_MS);

  // The later of a successful report's finishedAt and .last_success on arm-free (which only arrives
  // with the next heartbeat, and may hold when the copy started)
  const lastBackupMs = Math.max(hb?.last_success ?? 0, run?.ok ? run.finished_at : 0) || null;

  let request: BackupJobInfo['request'] = null;
  let cooldownSeconds = 0;
  if (req) {
    const { state, error } = effectiveState(req, now);
    request = {
      state,
      requestedAt: new Date(req.requested_at).toISOString(),
      startedAt: iso(req.started_at),
      finishedAt: iso(req.finished_at),
      sizeBytes: req.size_bytes ?? undefined,
      error: error ?? undefined,
    };
    cooldownSeconds = Math.max(0, Math.ceil((req.requested_at + REQUEST_COOLDOWN_MS - now) / 1000));
  }

  // Warn only while the premium VM runs, and count from when the server came online too, so
  // starting it after a long break does not warn before the first 30-minute backup has had a chance
  let overdue = false;
  if (ctx.vmState === 'RUNNING') {
    const onlineMs = ctx.onlineSince ? new Date(ctx.onlineSince).getTime() : NaN;
    const reference = Math.max(lastBackupMs ?? 0, isNaN(onlineMs) ? 0 : onlineMs);
    overdue = reference > 0 && now - reference > OVERDUE_MS;
  }

  return {
    configured: true,
    agent: hb
      ? {
          lastSeen: new Date(hb.seen_at).toISOString(),
          responding,
          busy: responding && hb.busy === 1,
          cronActive: hb.cron_active === null ? null : hb.cron_active === 1,
          scheduleInstalled: hb.schedule_installed === null ? null : hb.schedule_installed === 1,
        }
      : EMPTY_AGENT,
    lastBackupAt: lastBackupMs ? new Date(lastBackupMs).toISOString() : null,
    lastBackupBytes: hb?.archive_bytes ?? run?.size_bytes ?? null,
    lastRun: run
      ? {
          trigger: run.trigger,
          ok: run.ok === 1,
          finishedAt: new Date(run.finished_at).toISOString(),
          sizeBytes: run.size_bytes ?? undefined,
          error: run.error ?? undefined,
        }
      : null,
    request,
    cooldownSeconds,
    overdue,
  };
}
