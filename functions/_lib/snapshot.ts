// The agent's snapshot: everything arm-free saw on its last poll, on the single agent_heartbeat row.
//
// Written at most once every 50 seconds whatever the agent does, so the database sees about one
// write a minute (D1's free plan allows 100,000 a day; KV's 1,000 would not survive a heartbeat).
// Fields the agent did not send keep their previous value: an older mc-agent.sh that knows nothing
// about Minecraft probes or snapshots does not wipe them.

import { PollPayload } from './agentpayload';

export const SNAPSHOT_MIN_INTERVAL_MS = 50 * 1000;
// A request nobody picked up within this window counts as failed (see backupjob.ts)
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

export interface Health {
  tps: number | null;
  mspt: number | null;
  rssBytes: number | null;
  uptimeSec: number | null;
  memTotalBytes: number | null;
}

export interface SnapshotFile {
  name: string;
  sizeBytes: number;
  mtime: number;
}

export interface StoredSnapshot {
  seenAt: number;
  lastSuccess: number | null;
  archiveBytes: number | null;
  busy: boolean;
  cronActive: boolean | null;
  scheduleInstalled: boolean | null;
  // Minecraft as probed from arm-free over the private IP
  mcOnline: boolean | null;
  players: string[] | null;
  playersAt: number | null;
  playerCount: number | null;
  playerMax: number | null;
  version: string | null;
  health: Health | null;
  healthAt: number | null;
  snapshots: SnapshotFile[] | null;
}

interface Row {
  seen_at: number;
  last_success: number | null;
  archive_bytes: number | null;
  busy: number;
  cron_active: number | null;
  schedule_installed: number | null;
  mc_online: number | null;
  mc_players: string | null;
  mc_players_at: number | null;
  mc_player_count: number | null;
  mc_player_max: number | null;
  mc_version: string | null;
  health: string | null;
  health_at: number | null;
  snapshots: string | null;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const bit = (v: number | null) => (v === null ? null : v === 1);
const toBit = (v: boolean | null) => (v === null ? null : v ? 1 : 0);

function fromRow(row: Row): StoredSnapshot {
  return {
    seenAt: row.seen_at,
    lastSuccess: row.last_success,
    archiveBytes: row.archive_bytes,
    busy: row.busy === 1,
    cronActive: bit(row.cron_active),
    scheduleInstalled: bit(row.schedule_installed),
    mcOnline: bit(row.mc_online),
    players: parseJson<string[]>(row.mc_players),
    playersAt: row.mc_players_at,
    playerCount: row.mc_player_count,
    playerMax: row.mc_player_max,
    version: row.mc_version,
    health: parseJson<Health>(row.health),
    healthAt: row.health_at,
    snapshots: parseJson<SnapshotFile[]>(row.snapshots),
  };
}

export async function readSnapshot(db: D1Database): Promise<StoredSnapshot | null> {
  const row = await db.prepare('SELECT * FROM agent_heartbeat WHERE id = 1').first<Row>();
  return row ? fromRow(row) : null;
}

// Merge a poll into the previous snapshot. Only what the agent actually observed changes.
export function mergeSnapshot(prev: StoredSnapshot | null, p: PollPayload, now: number): StoredSnapshot {
  const next: StoredSnapshot = {
    seenAt: now,
    // a report may already have moved this forward (backupjob.recordRunReport); never go back
    lastSuccess: Math.max(p.lastSuccess ?? 0, prev?.lastSuccess ?? 0) || null,
    archiveBytes: p.archiveBytes ?? prev?.archiveBytes ?? null,
    busy: p.busy,
    cronActive: p.cronActive,
    scheduleInstalled: p.scheduleInstalled,
    mcOnline: prev?.mcOnline ?? null,
    players: prev?.players ?? null,
    playersAt: prev?.playersAt ?? null,
    playerCount: prev?.playerCount ?? null,
    playerMax: prev?.playerMax ?? null,
    version: prev?.version ?? null,
    health: prev?.health ?? null,
    healthAt: prev?.healthAt ?? null,
    snapshots: prev?.snapshots ?? null,
  };

  if (p.minecraft === null) {
    // The probe ran and could not reach Minecraft: it is not answering. Who was on stays as last
    // observed (playersAt does not move), so playtime is never counted past the last sighting.
    next.mcOnline = false;
  } else if (p.minecraft !== undefined) {
    next.mcOnline = p.minecraft.online;
    if (!p.minecraft.online) {
      next.players = [];
      next.playersAt = now;
      next.playerCount = 0;
    } else {
      next.playerCount = p.minecraft.count;
      next.playerMax = p.minecraft.max;
      next.version = p.minecraft.version;
      if (p.minecraft.players !== null) {
        next.players = p.minecraft.players;
        next.playersAt = now;
      }
    }
  }

  if (p.health !== undefined) {
    next.health = p.health;
    next.healthAt = now;
  }
  if (p.snapshots !== undefined) next.snapshots = p.snapshots;
  return next;
}

export function writeSnapshot(db: D1Database, s: StoredSnapshot): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO agent_heartbeat (id, seen_at, last_success, archive_bytes, busy, cron_active, schedule_installed,
         mc_online, mc_players, mc_players_at, mc_player_count, mc_player_max, mc_version, health, health_at, snapshots)
       VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT(id) DO UPDATE SET
         seen_at = excluded.seen_at,
         last_success = NULLIF(MAX(COALESCE(excluded.last_success, 0), COALESCE(agent_heartbeat.last_success, 0)), 0),
         archive_bytes = excluded.archive_bytes, busy = excluded.busy, cron_active = excluded.cron_active,
         schedule_installed = excluded.schedule_installed, mc_online = excluded.mc_online, mc_players = excluded.mc_players,
         mc_players_at = excluded.mc_players_at, mc_player_count = excluded.mc_player_count,
         mc_player_max = excluded.mc_player_max, mc_version = excluded.mc_version, health = excluded.health,
         health_at = excluded.health_at, snapshots = excluded.snapshots`
    )
    .bind(
      s.seenAt,
      s.lastSuccess,
      s.archiveBytes,
      s.busy ? 1 : 0,
      toBit(s.cronActive),
      toBit(s.scheduleInstalled),
      toBit(s.mcOnline),
      s.players ? JSON.stringify(s.players) : null,
      s.playersAt,
      s.playerCount,
      s.playerMax,
      s.version,
      s.health ? JSON.stringify(s.health) : null,
      s.healthAt,
      s.snapshots ? JSON.stringify(s.snapshots) : null
    );
}

// Hand over a pending "Backup now" exactly once (the UPDATE is the lock)
export function claimBackup(db: D1Database, now: number): D1PreparedStatement {
  return db
    .prepare(`UPDATE backup_request SET state = 'running', started_at = ?1 WHERE id = 1 AND state = 'pending' AND requested_at > ?2`)
    .bind(now, now - PENDING_TIMEOUT_MS);
}
