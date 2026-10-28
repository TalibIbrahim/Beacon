// Restores from arm-free's daily snapshots (restore_jobs table).
//
// Beacon only ever records "restore snapshot X" and hands the job's id and file name to the agent;
// the agent re-checks the name against the files it actually has and runs a fixed script. At most
// one restore is pending or running at a time, enforced by a conditional insert. While one is
// active, power actions and the auto-stop worker stay away from the VM.

export type RestoreState = 'pending' | 'running' | 'done' | 'failed';

// A request nobody picked up, or a run that never reported back, counts as failed after this
export const RESTORE_PENDING_TIMEOUT_MS = 10 * 60 * 1000;
export const RESTORE_RUNNING_TIMEOUT_MS = 90 * 60 * 1000;

export interface RestoreRow {
  id: number;
  snapshot: string;
  state: RestoreState;
  requested_at: number;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
}

export interface RestoreInfo {
  id: number;
  snapshot: string;
  state: RestoreState;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

// SQL for "a restore is active right now": pending and fresh, or running and fresh
const ACTIVE = `((state = 'pending' AND requested_at > ?1) OR (state = 'running' AND started_at > ?2))`;

function activeBinds(now: number): [number, number] {
  return [now - RESTORE_PENDING_TIMEOUT_MS, now - RESTORE_RUNNING_TIMEOUT_MS];
}

export async function activeRestore(db: D1Database, now = Date.now()): Promise<RestoreRow | null> {
  return db
    .prepare(`SELECT * FROM restore_jobs WHERE ${ACTIVE} ORDER BY id DESC LIMIT 1`)
    .bind(...activeBinds(now))
    .first<RestoreRow>();
}

// Returns the new job's id, or null when another restore is already active
export async function createRestore(db: D1Database, snapshot: string, now = Date.now()): Promise<number | null> {
  const row = await db
    .prepare(
      `INSERT INTO restore_jobs (snapshot, state, requested_at)
       SELECT ?3, 'pending', ?4 WHERE NOT EXISTS (SELECT 1 FROM restore_jobs WHERE ${ACTIVE})
       RETURNING id`
    )
    .bind(...activeBinds(now), snapshot, now)
    .first<{ id: number }>();
  return row?.id ?? null;
}

// Hand a pending restore to the agent exactly once; RETURNING gives the poll its id and file name
export function claimRestore(db: D1Database, now: number): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE restore_jobs SET state = 'running', started_at = ?1
       WHERE id = (SELECT id FROM restore_jobs WHERE state = 'pending' AND requested_at > ?2 ORDER BY id LIMIT 1)
       RETURNING id, snapshot`
    )
    .bind(now, now - RESTORE_PENDING_TIMEOUT_MS);
}

// Close a running restore. Returns the row when this report finished it.
export async function finishRestore(
  db: D1Database,
  id: number,
  ok: boolean,
  finishedAt: number,
  error: string | null
): Promise<RestoreRow | null> {
  return db
    .prepare(
      `UPDATE restore_jobs SET state = ?1, finished_at = ?2, error = ?3
       WHERE id = ?4 AND state = 'running' RETURNING *`
    )
    .bind(ok ? 'done' : 'failed', finishedAt, ok ? null : error, id)
    .first<RestoreRow>();
}

// The latest restore, with timed-out ones read as failed
export async function latestRestore(db: D1Database, now = Date.now()): Promise<RestoreInfo | null> {
  const row = await db.prepare('SELECT * FROM restore_jobs ORDER BY id DESC LIMIT 1').first<RestoreRow>();
  if (!row) return null;
  let state = row.state;
  let error = row.error;
  if (state === 'pending' && row.requested_at <= now - RESTORE_PENDING_TIMEOUT_MS) {
    state = 'failed';
    error = 'arm-free did not pick up the restore within 10 minutes. Nothing was changed.';
  } else if (state === 'running' && (row.started_at ?? 0) <= now - RESTORE_RUNNING_TIMEOUT_MS) {
    state = 'failed';
    error = 'No result from arm-free within 90 minutes. Check ~/mc-backup/agent.log on arm-free.';
  }
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : undefined);
  return {
    id: row.id,
    snapshot: row.snapshot,
    state,
    requestedAt: new Date(row.requested_at).toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    error: error ?? undefined,
  };
}
