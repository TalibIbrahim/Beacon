// POST /api/agent/poll - Heartbeat from mc-agent.sh on arm-free, once a minute.
// Bearer AGENT_TOKEN (checked in _middleware.ts). The answer is only ever { backup: true | false }.

import { parseBool, parseBytes, parseTime, readAgentJson } from '../../_lib/agent';
import { recordHeartbeatAndClaim } from '../../_lib/backupjob';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const body = await readAgentJson(request);
  if (!body) return json({ error: 'Invalid JSON body' }, 400);

  try {
    const backup = await recordHeartbeatAndClaim(env.AGENT_DB!, {
      lastSuccess: parseTime(body.lastSuccess),
      archiveBytes: parseBytes(body.archiveBytes),
      busy: parseBool(body.busy) ?? false,
      cronActive: parseBool(body.cronActive),
      scheduleInstalled: parseBool(body.scheduleInstalled),
    });
    return json({ backup });
  } catch (err) {
    console.error('Agent poll failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not record the heartbeat' }, 500);
  }
};
