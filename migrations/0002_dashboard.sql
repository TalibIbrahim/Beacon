-- What arm-free saw on its last poll, kept on the single heartbeat row (written at most once a
-- minute): Minecraft's status from the private-IP probe, server health, and the daily snapshots.
ALTER TABLE agent_heartbeat ADD COLUMN mc_online INTEGER;      -- 1 / 0; NULL when the probe did not run
ALTER TABLE agent_heartbeat ADD COLUMN mc_players TEXT;        -- JSON array of the names seen online
ALTER TABLE agent_heartbeat ADD COLUMN mc_players_at INTEGER;  -- when that list was last observed (epoch ms)
ALTER TABLE agent_heartbeat ADD COLUMN mc_player_count INTEGER;
ALTER TABLE agent_heartbeat ADD COLUMN mc_player_max INTEGER;
ALTER TABLE agent_heartbeat ADD COLUMN mc_version TEXT;
ALTER TABLE agent_heartbeat ADD COLUMN health TEXT;            -- JSON {tps, mspt, rssBytes, uptimeSec, memTotalBytes}
ALTER TABLE agent_heartbeat ADD COLUMN health_at INTEGER;
ALTER TABLE agent_heartbeat ADD COLUMN snapshots TEXT;         -- JSON [{name, sizeBytes, mtime}]

-- Things that happened, for Discord and for de-duplicating the same event from several sources
-- (power API, auto-stop worker, the agent). No IP hashes or tokens are stored here.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL,          -- dashboard | auto-stop | agent
  dedupe_key TEXT,
  details TEXT,                  -- JSON
  discord TEXT                   -- sent | failed | off
);
CREATE INDEX IF NOT EXISTS events_dedupe ON events (dedupe_key, created_at);
CREATE INDEX IF NOT EXISTS events_created ON events (created_at);

-- Playtime per player, keyed by lowercase name (offline mode: names are unverified text).
-- Written only on joins and leaves.
CREATE TABLE IF NOT EXISTS players (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,            -- latest casing seen
  total_ms INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,    -- end of the last closed session, or its start while online
  online_since INTEGER           -- start of the open session; NULL when offline
);
CREATE INDEX IF NOT EXISTS players_total ON players (total_ms DESC);

-- Restores from a daily snapshot. At most one is pending or running at a time.
CREATE TABLE IF NOT EXISTS restore_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot TEXT NOT NULL,
  state TEXT NOT NULL,           -- pending | running | done | failed
  requested_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS restore_jobs_state ON restore_jobs (state);
