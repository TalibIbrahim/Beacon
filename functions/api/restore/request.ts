// POST /api/restore/request - Restore the world from one of arm-free's daily snapshots.
// Session + CSRF protected like every dashboard route. Body: { snapshot, confirm: "RESTORE" }.
//
// Refused unless: the typed confirmation matches, the snapshot is in the agent's latest list,
// arm-free is responding, the VM is running, nobody is online (agent and mcsrvstat agree), no
// backup is running and no other restore is active. Beacon only records the request; the agent
// re-checks the file name against its own files and runs a fixed script.

import { getMaskedActor } from '../../_lib/auth';
import { SNAPSHOT_NAME } from '../../_lib/agentpayload';
import { getBackupJobInfo, isAgentConfigured } from '../../_lib/backupjob';
import { addActivityLog } from '../../_lib/log';
import { getMinecraftStatus } from '../../_lib/mcstatus';
import { getOciInstanceLifecycleState, getOciPublicIp } from '../../_lib/oci';
import { createRestore } from '../../_lib/restore';
import { Env } from '../../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAgentConfigured(env)) {
    return json({ error: 'Restores need the arm-free agent (DASH_DB and AGENT_TOKEN).' }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return json({ error: 'Invalid body' }, 400);
  const { snapshot, confirm, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return json({ error: `Unknown field ${Object.keys(rest)[0]}` }, 400);
  if (confirm !== 'RESTORE') return json({ error: 'Type RESTORE to confirm.' }, 400);
  if (typeof snapshot !== 'string' || !SNAPSHOT_NAME.test(snapshot)) return json({ error: 'Not a valid snapshot name.' }, 400);

  try {
    // Live checks: the VM's state from Oracle and who is on according to the public status API
    const [vmState, publicIp] = await Promise.all([getOciInstanceLifecycleState(env), getOciPublicIp(env)]);
    let playersOnline = 0;
    if (publicIp && vmState === 'RUNNING') {
      const mc = await getMinecraftStatus(env.DASH_KV, publicIp);
      if (mc.online) playersOnline = mc.players.online;
    }

    const job = await getBackupJobInfo(env, { vmState, onlineSince: null, playersOnline });
    if (job.restoreBlocked) return json({ error: job.restoreBlocked }, 409);
    if (!job.snapshots.some((s) => s.name === snapshot)) {
      return json({ error: 'That snapshot is not in the latest list from arm-free.' }, 400);
    }

    const id = await createRestore(env.DASH_DB, snapshot);
    if (id === null) return json({ error: 'A restore is already in progress.' }, 409);

    const actor = await getMaskedActor(request.headers.get('CF-Connecting-IP') || '127.0.0.1');
    await addActivityLog(env.DASH_KV, { action: 'RESTORE_REQUEST', result: 'SUCCESS', actor, details: snapshot });

    return json({ id, state: 'pending' });
  } catch (err) {
    console.error('Restore request failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not request the restore.' }, 500);
  }
};
