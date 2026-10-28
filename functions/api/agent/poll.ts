// POST /api/agent/poll - Heartbeat from mc-agent.sh on arm-free, once a minute.
// Bearer AGENT_TOKEN (checked in _middleware.ts). The body is validated strictly (agentpayload.ts).
// The answer only ever carries flags and ids, never commands.

import { PayloadError, parsePoll } from '../../_lib/agentpayload';
import { readAgentJson } from '../../_lib/agent';
import { emitEvents, NewEvent } from '../../_lib/events';
import { getOciPublicIp } from '../../_lib/oci';
import { claimBackup, mergeSnapshot, readSnapshot, SNAPSHOT_MIN_INTERVAL_MS, StoredSnapshot, writeSnapshot } from '../../_lib/snapshot';
import { Env } from '../../_lib/types';

// A previous snapshot older than this is a gap (arm-free or its cron was down): nothing that
// "changed" across it is announced, because we cannot say when it happened.
const GAP_MS = 3 * 60 * 1000;

// Discord events for what changed between two snapshots
async function serverEvents(env: Env, prev: StoredSnapshot | null, next: StoredSnapshot): Promise<NewEvent[]> {
  if (!prev || next.seenAt - prev.seenAt > GAP_MS) return [];
  const events: NewEvent[] = [];
  if (prev.mcOnline !== true && next.mcOnline === true) {
    let address: string | undefined;
    if (env.DISCORD_SHOW_ADDRESS === 'true') {
      const ip = await getOciPublicIp(env).catch(() => null);
      if (ip) address = `${ip}:25565`;
    }
    events.push({ type: 'server_online', source: 'agent', dedupeKey: 'server_online', dedupeWindowMs: 5 * 60 * 1000, details: { address } });
  }
  if (prev.mcOnline === true && next.mcOnline === false) {
    // A stop from the dashboard or the auto-stop worker already posted this; the shared key skips it
    events.push({
      type: 'server_stopped',
      source: 'agent',
      dedupeKey: 'server_stopped',
      dedupeWindowMs: 5 * 60 * 1000,
      details: { reason: 'Minecraft stopped responding' },
    });
  }
  return events;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, waitUntil } = context;
  const db = env.DASH_DB!;

  const body = await readAgentJson(request);
  if (!body) return json({ error: 'Invalid JSON body (or over 8 KB)' }, 400);

  let payload;
  try {
    payload = parsePoll(body);
  } catch (err) {
    if (err instanceof PayloadError) return json({ error: err.message }, 400);
    throw err;
  }

  try {
    const now = Date.now();
    const prev = await readSnapshot(db);
    const statements: D1PreparedStatement[] = [claimBackup(db, now)];

    // At most one snapshot write every 50 seconds, however often the agent calls
    let next: StoredSnapshot | null = null;
    if (!prev || now - prev.seenAt >= SNAPSHOT_MIN_INTERVAL_MS) {
      next = mergeSnapshot(prev, payload, now);
      statements.push(writeSnapshot(db, next));
    }

    const [claim] = await db.batch(statements);

    // Discord runs after the answer is sent, so it never slows the poll
    if (next) {
      const changed = next;
      waitUntil(serverEvents(env, prev, changed).then((events) => emitEvents(env, events, now)));
    }
    return json({ backup: (claim.meta.changes ?? 0) === 1 });
  } catch (err) {
    console.error('Agent poll failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not record the heartbeat' }, 500);
  }
};
