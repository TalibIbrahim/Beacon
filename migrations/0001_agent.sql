-- Backup agent on arm-free: heartbeat, the "Backup now" request, the last backup run, and the
-- agent routes' rate-limit counters. These tables existed before migrations (created on first use),
-- so every statement is IF NOT EXISTS and is safe on a database that already has them.

CREATE TABLE IF NOT EXISTS agent_heartbeat (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seen_at INTEGER NOT NULL,
  last_success INTEGER,
  archive_bytes INTEGER,
  busy INTEGER NOT NULL DEFAULT 0,
  cron_active INTEGER,
  schedule_installed INTEGER
);

CREATE TABLE IF NOT EXISTS backup_request (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  size_bytes INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS backup_last_run (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  trigger TEXT NOT NULL,
  ok INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  size_bytes INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS agent_rate (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
