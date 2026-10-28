// POST /api/agent/report - Result of a backup run on arm-free.
// Bearer AGENT_TOKEN (checked in _middleware.ts). The body is validated strictly (agentpayload.ts):
// { trigger: "requested" | "scheduled", ok, finishedAt, sizeBytes?, error? }

import { PayloadError, parseReport } from '../../_lib/agentpayload';
import { readAgentJson } from '../../_lib/agent';
import { clearBackupProbeCache } from '../../_lib/backup';
import { recordRunReport } from '../../_lib/backupjob';
import { emitEvents } from '../../_lib/events';
import { addActivityLog } from '../../_lib/log';
import { finishRestore } from '../../_lib/restore';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, waitUntil } = context;

  const body = await readAgentJson(request);
  if (!body) return json({ error: 'Invalid JSON body (or over 8 KB)' }, 400);

  let report;
  try {
    report = parseReport(body);
  } catch (err) {
    if (err instanceof PayloadError) return json({ error: err.message }, 400);
    throw err;
  }
  if (report.kind === 'restore') {
    try {
      const row = await finishRestore(env.DASH_DB!, report.restoreId!, report.ok, report.finishedAt, report.error);
      if (row) {
        if (env.DASH_KV) {
          await addActivityLog(env.DASH_KV, {
            action: 'RESTORE_RUN',
            result: report.ok ? 'SUCCESS' : 'FAILED',
            actor: 'agent',
            details: report.ok ? row.snapshot : report.error ?? undefined,
          });
        }
        waitUntil(
          emitEvents(env, [
            {
              type: 'restore_finished',
              source: 'agent',
              dedupeKey: `restore:${row.id}:finish`,
              dedupeWindowMs: 24 * 60 * 60 * 1000,
              details: { ok: report.ok, snapshot: row.snapshot, reason: report.error ?? undefined },
            },
          ])
        );
      }
      return json({ recorded: Boolean(row) });
    } catch (err) {
      console.error('Restore report failed:', err instanceof Error ? err.message : err);
      return json({ error: 'Could not record the report' }, 500);
    }
  }

  const { trigger, ok, finishedAt, sizeBytes, error } = report;

  try {
    const closedRequest = await recordRunReport(env.DASH_DB!, { trigger, ok, finishedAt, sizeBytes, error });
    // A new archive may be in the bucket. /api/status also re-checks it after any report (see
    // resolveBackup's freshAfter); deleting the cached check here covers /api/backup in this location.
    await clearBackupProbeCache(env);

    // Discord: every failed "Backup now", and failed scheduled runs at most once every 3 hours
    if (!ok) {
      waitUntil(
        emitEvents(env, [
          trigger === 'scheduled'
            ? { type: 'backup_failed', source: 'agent', dedupeKey: 'backup_failed:scheduled', dedupeWindowMs: 3 * 60 * 60 * 1000, details: { reason: error ?? undefined } }
            : { type: 'backup_failed', source: 'agent', details: { reason: error ?? undefined } },
        ])
      );
    }

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
