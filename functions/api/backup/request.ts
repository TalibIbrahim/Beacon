// POST /api/backup/request - "Backup now": ask arm-free to run a backup on its next poll.
// Session + CSRF protected like every other dashboard route. One request at a time, and one
// every 5 minutes at most.

import { getMaskedActor } from '../../_lib/auth';
import { createBackupRequest, isAgentConfigured } from '../../_lib/backupjob';
import { addActivityLog } from '../../_lib/log';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAgentConfigured(env)) {
    return json({ error: 'Backups from arm-free are not set up yet (DASH_DB and AGENT_TOKEN).' }, 503);
  }

  try {
    const result = await createBackupRequest(env.DASH_DB);

    if (!result.ok && result.reason === 'busy') {
      return json(
        { error: result.state === 'running' ? 'A backup is already running.' : 'A backup is already requested.' },
        409
      );
    }
    if (!result.ok) {
      return json(
        { error: `Backups can be requested every 5 minutes. Try again in ${result.retryAfter}s.`, retryAfter: result.retryAfter },
        429,
        { 'Retry-After': result.retryAfter.toString() }
      );
    }

    if (env.DASH_KV) {
      const actor = await getMaskedActor(request.headers.get('CF-Connecting-IP') || '127.0.0.1');
      await addActivityLog(env.DASH_KV, { action: 'BACKUP_REQUEST', result: 'SUCCESS', actor });
    }

    return json({ state: 'pending' });
  } catch (err) {
    console.error('Backup request failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not request a backup.' }, 500);
  }
};
