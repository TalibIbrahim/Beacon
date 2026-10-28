// POST /api/agent/report - Result of a backup run on arm-free.
// Bearer AGENT_TOKEN (checked in _middleware.ts).
// Body: { ok, finishedAt, sizeBytes?, error?, trigger: "requested" | "scheduled" }

import { parseBool, parseBytes, parseMessage, parseTime, readAgentJson } from '../../_lib/agent';
import { recordRunReport } from '../../_lib/backupjob';
import { addActivityLog } from '../../_lib/log';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const body = await readAgentJson(request);
  const ok = body ? parseBool(body.ok) : null;
  const finishedAt = body ? parseTime(body.finishedAt) : null;
  if (!body || ok === null || finishedAt === null) {
    return json({ error: 'Expected { ok: boolean, finishedAt: ISO 8601 time }' }, 400);
  }

  const trigger = body.trigger === 'scheduled' ? 'scheduled' : 'requested';
  const sizeBytes = parseBytes(body.sizeBytes);
  const error = ok ? null : parseMessage(body.error) ?? 'Backup failed (no reason given).';

  try {
    const closedRequest = await recordRunReport(env.AGENT_DB!, { trigger, ok, finishedAt, sizeBytes, error });

    // Only "Backup now" results go to the activity log; the 30-minute runs would crowd it out
    // (and each entry is a KV write, which the free plan limits to 1,000 a day)
    if (closedRequest && env.DASH_KV) {
      await addActivityLog(env.DASH_KV, {
        action: 'BACKUP_RUN',
        result: ok ? 'SUCCESS' : 'FAILED',
        actor: 'agent',
        details: ok ? formatSize(sizeBytes) ?? undefined : error ?? undefined,
      });
    }
    return json({ recorded: true });
  } catch (err) {
    console.error('Agent report failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not record the report' }, 500);
  }
};
