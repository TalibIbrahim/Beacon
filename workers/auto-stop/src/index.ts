// Cloudflare Worker: Auto-Stop Cron Trigger for Minecraft Server
// Runs every 10 minutes. If VM is RUNNING and Minecraft has 0 players for AUTO_STOP_MINUTES (default 30),
// sends SOFTSTOP to OCI and writes an entry to the activity log.

import { emitEvents } from '../../../functions/_lib/events';
import { activeRestore } from '../../../functions/_lib/restore';
import { addActivityLog } from '../../../functions/_lib/log';
import { getMinecraftStatus } from '../../../functions/_lib/mcstatus';
import {
  getOciInstanceLifecycleState,
  getOciPublicIp,
  sendOciPowerAction,
} from '../../../functions/_lib/oci';

export interface AutoStopEnv {
  DASH_KV: KVNamespace;
  // Same D1 database as the dashboard (events, restore jobs); optional so the worker still runs without it
  DASH_DB?: D1Database;
  // Discord alerts: same secret and settings as the dashboard
  DISCORD_WEBHOOK_URL?: string;
  DISCORD_EVENTS?: string;
  OCI_TENANCY_OCID: string;
  OCI_USER_OCID: string;
  OCI_FINGERPRINT: string;
  OCI_PRIVATE_KEY_B64: string;
  OCI_REGION?: string;
  OCI_INSTANCE_OCID: string;
  OCI_COMPARTMENT_OCID: string;
  AUTO_STOP_MINUTES?: string;
}

const EMPTY_SINCE_KEY = 'empty_since';
const ONLINE_SINCE_KEY = 'online_since';

async function handleAutoStopCheck(env: AutoStopEnv): Promise<string> {
  const thresholdMinutes = parseInt(env.AUTO_STOP_MINUTES || '30', 10);
  const thresholdMs = thresholdMinutes * 60 * 1000;

  // 0. Never stop the VM while a restore is copying the world onto it
  if (env.DASH_DB) {
    const restoring = await activeRestore(env.DASH_DB).catch(() => null);
    if (restoring) {
      await env.DASH_KV.delete(EMPTY_SINCE_KEY);
      return `Restore #${restoring.id} in progress. No action taken.`;
    }
  }

  // 1. Check VM state from OCI
  const vmState = await getOciInstanceLifecycleState(env as any);
  if (vmState !== 'RUNNING') {
    // If server is not running, ensure empty_since is cleared
    await env.DASH_KV.delete(EMPTY_SINCE_KEY);
    return `VM is not RUNNING (current state: ${vmState}). No action taken.`;
  }

  // 2. Resolve public IP
  const publicIp = await getOciPublicIp(env as any);
  if (!publicIp) {
    return 'Public IP not available yet. Skipping check.';
  }

  // 3. Query Minecraft status
  const mcStatus = await getMinecraftStatus(env.DASH_KV, publicIp);

  // If players are online, reset empty_since timer
  if (mcStatus.online && mcStatus.players.online > 0) {
    await env.DASH_KV.delete(EMPTY_SINCE_KEY);
    return `Server has ${mcStatus.players.online} active player(s). Timer reset.`;
  }

  // 4. Server has 0 players or is reporting offline while VM is running
  const now = Date.now();
  const emptySinceRaw = await env.DASH_KV.get(EMPTY_SINCE_KEY);

  if (!emptySinceRaw) {
    // Start tracking empty time
    await env.DASH_KV.put(EMPTY_SINCE_KEY, now.toString(), { expirationTtl: 86400 });
    return `Server empty. Started idle timer at ${new Date(now).toISOString()}.`;
  }

  const emptySince = parseInt(emptySinceRaw, 10);
  const elapsedMs = now - emptySince;
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

  if (elapsedMs >= thresholdMs) {
    // Graceful auto-shutdown
    const powerRes = await sendOciPowerAction(env as any, 'SOFTSTOP');

    if (powerRes.success) {
      await Promise.all([
        addActivityLog(env.DASH_KV, {
          action: 'STOP',
          result: 'SUCCESS',
          actor: 'cron',
          details: `Auto-stopped after ${elapsedMinutes}m idle with 0 players`,
        }),
        env.DASH_KV.delete(EMPTY_SINCE_KEY),
        env.DASH_KV.delete(ONLINE_SINCE_KEY),
        // Shares its key with the dashboard and the agent, so the stop is posted once
        emitEvents(env, [
          {
            type: 'server_stopped',
            source: 'auto-stop',
            dedupeKey: 'server_stopped',
            dedupeWindowMs: 5 * 60 * 1000,
            details: { reason: `idle auto-stop after ${elapsedMinutes}m with nobody online` },
          },
        ]),
      ]);
      return `Threshold reached (${elapsedMinutes}m >= ${thresholdMinutes}m). Sent SOFTSTOP.`;
    } else {
      await addActivityLog(env.DASH_KV, {
        action: 'STOP',
        result: 'FAILED',
        actor: 'cron',
        details: `Auto-stop failed: HTTP ${powerRes.status}`,
      });
      return `Failed to send SOFTSTOP: HTTP ${powerRes.status}`;
    }
  }

  return `Server empty for ${elapsedMinutes}m (threshold is ${thresholdMinutes}m). Waiting.`;
}

export default {
  // Cron Trigger handler
  async scheduled(event: ScheduledEvent, env: AutoStopEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      handleAutoStopCheck(env).then((res) => {
        console.log(`[Auto-Stop Cron] ${res}`);
      }).catch((err) => {
        console.error('[Auto-Stop Cron Error]', err);
      })
    );
  },

  // HTTP handler for manual testing / debug triggers
  async fetch(request: Request, env: AutoStopEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/trigger') {
      const result = await handleAutoStopCheck(env);
      return new Response(JSON.stringify({ result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Beacon Auto-Stop Worker', { status: 200 });
  },
};
