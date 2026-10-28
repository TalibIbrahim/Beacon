// Strict validation of what the agent on arm-free sends. Anything outside the schema (an unknown
// field, a wrong type, a list or string over its cap) rejects the whole request with a reason, so a
// broken or hostile client cannot slip extra data into D1. Times outside a sane range become null
// rather than failing the poll, so a wrong clock on arm-free cannot take the heartbeat down.

export class PayloadError extends Error {}

type Obj = Record<string, unknown>;

const EARLIEST = Date.UTC(2020, 0, 1);

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function onlyKeys(o: Obj, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) throw new PayloadError(`Unknown field ${where}${key}`);
  }
}

function optBool(v: unknown, name: string): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'boolean') throw new PayloadError(`${name} must be a boolean`);
  return v;
}

function optInt(v: unknown, name: string, max: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) {
    throw new PayloadError(`${name} must be a whole number from 0 to ${max}`);
  }
  return v;
}

function optNumber(v: unknown, name: string, max: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) {
    throw new PayloadError(`${name} must be a number from 0 to ${max}`);
  }
  return Math.round(v * 100) / 100;
}

function optString(v: unknown, name: string, maxLen: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || v.length > maxLen) throw new PayloadError(`${name} must be text of at most ${maxLen} characters`);
  return v;
}

// ISO 8601 time -> epoch ms; null when missing or outside 2020..now+5min
function optTime(v: unknown, name: string): number | null {
  const s = optString(v, name, 40);
  if (s === null) return null;
  const t = Date.parse(s);
  if (isNaN(t) || t < EARLIEST || t > Date.now() + 5 * 60 * 1000) return null;
  return t;
}

// Short, single-line, printable: it ends up on the dashboard, in the activity log and in Discord
export function cleanMessage(v: unknown, maxLen = 200): string | null {
  if (typeof v !== 'string') return null;
  const clean = v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, maxLen);
  return clean || null;
}

// --- POST /api/agent/poll -----------------------------------------------------------------------

// Daily snapshot names: what mc-backup.sh writes (world-YYYY-MM-DD.tar.zst) and similar safe names.
// No slashes, no leading dot: the agent re-checks every name against real files anyway.
export const SNAPSHOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const MAX_PLAYERS_LISTED = 200;
export const MAX_SNAPSHOTS = 60;

export interface PollPayload {
  lastSuccess: number | null;
  archiveBytes: number | null;
  busy: boolean;
  cronActive: boolean | null;
  scheduleInstalled: boolean | null;
  // undefined: the agent did not include it (older mc-agent.sh); null: the probe ran and failed
  minecraft?: {
    online: boolean;
    players: string[] | null; // null when the server does not list names
    count: number | null;
    max: number | null;
    version: string | null;
  } | null;
  health?: {
    tps: number | null;
    mspt: number | null;
    rssBytes: number | null;
    uptimeSec: number | null;
    memTotalBytes: number | null;
  } | null;
  snapshots?: Array<{ name: string; sizeBytes: number; mtime: number }>;
}

export function parsePoll(body: unknown): PollPayload {
  if (!isObj(body)) throw new PayloadError('Body must be a JSON object');
  onlyKeys(body, ['lastSuccess', 'archiveBytes', 'busy', 'cronActive', 'scheduleInstalled', 'minecraft', 'health', 'snapshots'], '');

  const out: PollPayload = {
    lastSuccess: optTime(body.lastSuccess, 'lastSuccess'),
    archiveBytes: optInt(body.archiveBytes, 'archiveBytes', 1e13),
    busy: optBool(body.busy, 'busy') ?? false,
    cronActive: optBool(body.cronActive, 'cronActive'),
    scheduleInstalled: optBool(body.scheduleInstalled, 'scheduleInstalled'),
  };

  if (body.minecraft === null) {
    out.minecraft = null;
  } else if (body.minecraft !== undefined) {
    const mc = body.minecraft;
    if (!isObj(mc)) throw new PayloadError('minecraft must be an object or null');
    onlyKeys(mc, ['online', 'players', 'count', 'max', 'version'], 'minecraft.');
    if (typeof mc.online !== 'boolean') throw new PayloadError('minecraft.online must be a boolean');
    let players: string[] | null = null;
    if (mc.players !== undefined && mc.players !== null) {
      if (!Array.isArray(mc.players) || mc.players.length > MAX_PLAYERS_LISTED) {
        throw new PayloadError(`minecraft.players must be a list of at most ${MAX_PLAYERS_LISTED} names`);
      }
      players = mc.players.map((p, i) => {
        if (typeof p !== 'string' || p.length === 0 || p.length > 64) {
          throw new PayloadError(`minecraft.players[${i}] must be a name of 1 to 64 characters`);
        }
        return p;
      });
    }
    out.minecraft = {
      online: mc.online,
      players,
      count: optInt(mc.count, 'minecraft.count', 100000),
      max: optInt(mc.max, 'minecraft.max', 100000),
      version: optString(mc.version, 'minecraft.version', 100),
    };
  }

  if (body.health === null) {
    out.health = null;
  } else if (body.health !== undefined) {
    const h = body.health;
    if (!isObj(h)) throw new PayloadError('health must be an object or null');
    onlyKeys(h, ['tps', 'mspt', 'rssBytes', 'uptimeSec', 'memTotalBytes'], 'health.');
    out.health = {
      tps: optNumber(h.tps, 'health.tps', 100),
      mspt: optNumber(h.mspt, 'health.mspt', 100000),
      rssBytes: optInt(h.rssBytes, 'health.rssBytes', 1e13),
      uptimeSec: optInt(h.uptimeSec, 'health.uptimeSec', 1e10),
      memTotalBytes: optInt(h.memTotalBytes, 'health.memTotalBytes', 1e13),
    };
  }

  if (body.snapshots !== undefined) {
    if (!Array.isArray(body.snapshots) || body.snapshots.length > MAX_SNAPSHOTS) {
      throw new PayloadError(`snapshots must be a list of at most ${MAX_SNAPSHOTS} entries`);
    }
    out.snapshots = body.snapshots.map((s, i) => {
      if (!isObj(s)) throw new PayloadError(`snapshots[${i}] must be an object`);
      onlyKeys(s, ['name', 'sizeBytes', 'mtime'], `snapshots[${i}].`);
      if (typeof s.name !== 'string' || !SNAPSHOT_NAME.test(s.name)) {
        throw new PayloadError(`snapshots[${i}].name is not a valid file name`);
      }
      return {
        name: s.name,
        sizeBytes: optInt(s.sizeBytes, `snapshots[${i}].sizeBytes`, 1e13) ?? 0,
        mtime: optTime(s.mtime, `snapshots[${i}].mtime`) ?? 0,
      };
    });
  }

  return out;
}

// --- POST /api/agent/report ---------------------------------------------------------------------

export interface ReportPayload {
  kind: 'backup' | 'restore';
  trigger: 'requested' | 'scheduled';
  ok: boolean;
  finishedAt: number;
  sizeBytes: number | null;
  error: string | null;
  restoreId: number | null;
}

export function parseReport(body: unknown): ReportPayload {
  if (!isObj(body)) throw new PayloadError('Body must be a JSON object');
  onlyKeys(body, ['kind', 'trigger', 'ok', 'finishedAt', 'sizeBytes', 'error', 'restoreId'], '');

  const kind = body.kind === undefined ? 'backup' : body.kind;
  if (kind !== 'backup' && kind !== 'restore') throw new PayloadError('kind must be "backup" or "restore"');
  const trigger = body.trigger === undefined ? 'requested' : body.trigger;
  if (trigger !== 'requested' && trigger !== 'scheduled') throw new PayloadError('trigger must be "requested" or "scheduled"');
  if (typeof body.ok !== 'boolean') throw new PayloadError('ok must be a boolean');
  const finishedAt = optTime(body.finishedAt, 'finishedAt');
  if (finishedAt === null) throw new PayloadError('finishedAt must be an ISO 8601 time');
  if (body.error !== undefined && body.error !== null && typeof body.error !== 'string') {
    throw new PayloadError('error must be text');
  }
  const restoreId = optInt(body.restoreId, 'restoreId', Number.MAX_SAFE_INTEGER);
  if (kind === 'restore' && restoreId === null) throw new PayloadError('restoreId is required for a restore report');

  return {
    kind,
    trigger,
    ok: body.ok,
    finishedAt,
    sizeBytes: optInt(body.sizeBytes, 'sizeBytes', 1e13),
    error: body.ok ? null : cleanMessage(body.error) ?? (kind === 'restore' ? 'Restore failed (no reason given).' : 'Backup failed (no reason given).'),
    restoreId,
  };
}
