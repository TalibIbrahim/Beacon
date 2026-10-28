// POST /api/agent/poll - Heartbeat from mc-agent.sh on arm-free, once a minute.
// Bearer AGENT_TOKEN (checked in _middleware.ts). The body is validated strictly (agentpayload.ts).
// The answer only ever carries flags and ids, never commands.

import { PayloadError, parsePoll } from '../../_lib/agentpayload';
import { readAgentJson } from '../../_lib/agent';
import { claimBackup, mergeSnapshot, readSnapshot, SNAPSHOT_MIN_INTERVAL_MS, writeSnapshot } from '../../_lib/snapshot';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
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
    if (!prev || now - prev.seenAt >= SNAPSHOT_MIN_INTERVAL_MS) {
      statements.push(writeSnapshot(db, mergeSnapshot(prev, payload, now)));
    }

    const [claim] = await db.batch(statements);
    return json({ backup: (claim.meta.changes ?? 0) === 1 });
  } catch (err) {
    console.error('Agent poll failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not record the heartbeat' }, 500);
  }
};
