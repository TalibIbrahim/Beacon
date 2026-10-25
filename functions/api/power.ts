// POST /api/power - Execute VM power actions with server-side validation and cooldowns

import { getMaskedActor } from '../_lib/auth';
import { addActivityLog } from '../_lib/log';
import { getMinecraftStatus } from '../_lib/mcstatus';
import {
  getOciInstanceLifecycleState,
  getOciPublicIp,
  sendOciPowerAction,
} from '../_lib/oci';
import {
  checkPowerCooldown,
  recordPowerActionCooldown,
} from '../_lib/ratelimit';
import { Env } from '../_lib/types';

interface PowerRequestBody {
  action?: string;
  force?: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

  if (!env.DASH_KV) {
    return new Response(
      JSON.stringify({
        error: "KV storage is not connected. In Cloudflare Settings -> Bindings, add a KV namespace binding named 'DASH_KV' pointing to 'beacon-kv'.",
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: PowerRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const action = body.action;
  const force = Boolean(body.force);

  if (action !== 'start' && action !== 'stop' && action !== 'restart') {
    return new Response(
      JSON.stringify({ error: 'Invalid action. Must be start, stop, or restart.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 1. Check 30-second power action cooldown
  const cooldown = await checkPowerCooldown(env.DASH_KV);
  if (cooldown.onCooldown) {
    return new Response(
      JSON.stringify({
        error: `Action cooldown active. Please wait ${cooldown.remainingSeconds}s before another action.`,
        remainingSeconds: cooldown.remainingSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': cooldown.remainingSeconds.toString(),
        },
      }
    );
  }

  // 2. Fetch current VM lifecycle state from OCI
  const currentState = await getOciInstanceLifecycleState(env);

  // 3. Enforce strict server-side state rules:
  // - start only when STOPPED
  // - stop only when RUNNING
  // - restart only when RUNNING
  if (action === 'start' && currentState !== 'STOPPED') {
    return new Response(
      JSON.stringify({
        error: `Cannot start server while in state '${currentState}'. Server must be STOPPED.`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (action === 'stop' && currentState !== 'RUNNING') {
    return new Response(
      JSON.stringify({
        error: `Cannot stop server while in state '${currentState}'. Server must be RUNNING.`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (action === 'restart' && currentState !== 'RUNNING') {
    return new Response(
      JSON.stringify({
        error: `Cannot restart server while in state '${currentState}'. Server must be RUNNING.`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 4. Player count guard for stop/restart:
  // "Stop or restart with players > 0 requires force: true."
  if ((action === 'stop' || action === 'restart') && !force) {
    const publicIp = await getOciPublicIp(env);
    if (publicIp) {
      const mcStatus = await getMinecraftStatus(env.DASH_KV, publicIp);
      if (mcStatus.online && mcStatus.players.online > 0) {
        return new Response(
          JSON.stringify({
            error: `There are ${mcStatus.players.online} player(s) online. Confirmation required.`,
            requiresForce: true,
            playerCount: mcStatus.players.online,
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  }

  // 5. Map to OCI action name:
  // Start = START, Stop = SOFTSTOP, Restart = SOFTRESET
  const ociActionMap: Record<string, 'START' | 'SOFTSTOP' | 'SOFTRESET'> = {
    start: 'START',
    stop: 'SOFTSTOP',
    restart: 'SOFTRESET',
  };

  const ociAction = ociActionMap[action];
  const maskedActor = await getMaskedActor(clientIp);

  // 6. Send request to OCI
  const result = await sendOciPowerAction(env, ociAction);

  const actionUpper = action.toUpperCase() as 'START' | 'STOP' | 'RESTART';

  if (!result.success) {
    await addActivityLog(env.DASH_KV, {
      action: actionUpper,
      result: 'FAILED',
      actor: maskedActor,
    });

    return new Response(
      JSON.stringify({
        error: `Failed to execute ${action} command on Oracle Cloud.`,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 7. On success: record 30s cooldown and write activity log
  await Promise.all([
    recordPowerActionCooldown(env.DASH_KV),
    addActivityLog(env.DASH_KV, {
      action: actionUpper,
      result: 'SUCCESS',
      actor: maskedActor,
    }),
  ]);

  return new Response(
    JSON.stringify({
      success: true,
      action,
      message: `Successfully requested ${action} for instance.`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
