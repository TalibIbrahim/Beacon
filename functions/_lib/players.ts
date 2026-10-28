// Playtime and last seen, from the online-player lists arm-free reports every minute.
//
// Players are keyed by lowercase name (offline mode: names are unverified text, so this is a
// label, not an identity) and shown with the latest casing seen. D1 is written only when someone
// joins or leaves. Playtime is never inflated: a session always ends at the last poll that actually
// saw the player, and a gap in the polls (arm-free down, Minecraft not answering) ends every open
// session at its last sighting instead of counting the gap.

import { NewEvent } from './events';
import { StoredSnapshot } from './snapshot';

// A previous sighting older than this is a gap: sessions end at that sighting
export const SIGHTING_GAP_MS = 3 * 60 * 1000;
const LEADERBOARD_SIZE = 10;

interface OpenRow {
  key: string;
  name: string;
  online_since: number;
}

export interface PlayerChanges {
  statements: D1PreparedStatement[];
  events: NewEvent[];
}

function uniqueByKey(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of names) {
    const display = name.slice(0, 64);
    map.set(display.toLowerCase(), display);
  }
  return map;
}

// Compare who is online now with the sessions open in D1. Only runs when this poll actually
// observed the player list (next.playersAt === now); an unknown list changes nothing.
export async function playerChanges(
  db: D1Database,
  prev: StoredSnapshot | null,
  next: StoredSnapshot,
  now: number
): Promise<PlayerChanges> {
  const result: PlayerChanges = { statements: [], events: [] };
  if (next.playersAt !== now || next.players === null) return result;

  const online = uniqueByKey(next.players);
  const open = (await db.prepare('SELECT key, name, online_since FROM players WHERE online_since IS NOT NULL').all<OpenRow>())
    .results;

  // When was the previous list observed? Sessions still open were last seen then.
  const lastSighting = prev?.playersAt ?? null;
  const gap = lastSighting === null || now - lastSighting > SIGHTING_GAP_MS;
  // Minecraft is down: everyone left with it, and the "stopped" alert says so once
  const serverDown = next.mcOnline === false;
  const announce = !gap;

  const close = (row: OpenRow) => {
    // Last seen at the previous sighting, never before the session began
    const end = Math.max(row.online_since, lastSighting ?? row.online_since);
    result.statements.push(
      db
        .prepare(
          `UPDATE players SET total_ms = total_ms + MAX(0, ?1 - online_since), last_seen = ?1, online_since = NULL
           WHERE key = ?2 AND online_since IS NOT NULL`
        )
        .bind(end, row.key)
    );
    return end - row.online_since;
  };

  const openKeys = new Set(open.map((r) => r.key));
  for (const row of open) {
    if (!online.has(row.key)) {
      const played = close(row);
      // A whole server going down is one "stopped" alert, not a leave per player
      if (announce && !serverDown) {
        result.events.push({
          type: 'player_left',
          source: 'agent',
          dedupeKey: `left:${row.key}`,
          dedupeWindowMs: 2 * 60 * 1000,
          details: { name: row.name, playedMs: played },
        });
      }
    } else if (gap) {
      // Still on after a gap: end the old session at its last sighting, start a new one now
      close(row);
      openKeys.delete(row.key);
    }
  }

  for (const [key, name] of online) {
    if (openKeys.has(key)) continue;
    result.statements.push(
      db
        .prepare(
          `INSERT INTO players (key, name, total_ms, sessions, first_seen, last_seen, online_since)
           VALUES (?1, ?2, 0, 1, ?3, ?3, ?3)
           ON CONFLICT(key) DO UPDATE SET
             name = excluded.name, sessions = players.sessions + 1,
             last_seen = excluded.last_seen, online_since = excluded.online_since`
        )
        .bind(key, name, now)
    );
    if (announce) {
      result.events.push({
        type: 'player_joined',
        source: 'agent',
        dedupeKey: `join:${key}`,
        dedupeWindowMs: 2 * 60 * 1000,
        details: { name },
      });
    }
  }

  return result;
}

// --- Leaderboard --------------------------------------------------------------------------------

export interface LeaderboardEntry {
  name: string;
  totalMs: number;
  sessions: number;
  lastSeen: string;
  online: boolean;
}

interface PlayerRow {
  key: string;
  name: string;
  total_ms: number;
  sessions: number;
  last_seen: number;
  online_since: number | null;
}

// Top players by playtime. An open session counts up to the last sighting, and only reads as
// "online now" while that sighting is fresh.
export async function getLeaderboard(
  db: D1Database,
  snapshot: StoredSnapshot | null,
  now = Date.now()
): Promise<LeaderboardEntry[]> {
  const [top, open] = await db.batch([
    db.prepare('SELECT * FROM players ORDER BY total_ms DESC LIMIT 25'),
    db.prepare('SELECT * FROM players WHERE online_since IS NOT NULL'),
  ]);
  const rows = new Map<string, PlayerRow>();
  for (const r of [...(top.results as PlayerRow[]), ...(open.results as PlayerRow[])]) rows.set(r.key, r);

  const sighting = snapshot?.playersAt ?? null;
  const fresh = sighting !== null && now - sighting <= SIGHTING_GAP_MS;

  return [...rows.values()]
    .map((r) => {
      const openUntil = r.online_since !== null && sighting !== null ? Math.max(r.online_since, sighting) : null;
      const openMs = r.online_since !== null && openUntil !== null ? openUntil - r.online_since : 0;
      return {
        name: r.name,
        totalMs: r.total_ms + openMs,
        sessions: r.sessions,
        lastSeen: new Date(openUntil ?? r.last_seen).toISOString(),
        online: r.online_since !== null && fresh,
      };
    })
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, LEADERBOARD_SIZE);
}
