// GET /api/status - Retrieve VM state, Minecraft server status, players, and logs

import { getRecentActivityLog } from '../_lib/log';
import { getMinecraftStatus } from '../_lib/mcstatus';
import { getOciInstanceDetails, getOciPublicIp } from '../_lib/oci';
import { checkPowerCooldown } from '../_lib/ratelimit';
import { BackupInfo, Env, MinecraftState, StatusResponse, VmState } from '../_lib/types';

const ONLINE_SINCE_KEY = 'online_since';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.DASH_KV) {
    return new Response(
      JSON.stringify({
        error: "KV storage is not connected. In Cloudflare Settings -> Bindings, add a KV namespace binding named 'DASH_KV' pointing to 'beacon-kv'.",
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Fetch OCI instance details (lifecycle + hardware specs) and public IP in parallel
    const [instanceDetails, publicIpResult, powerCooldown] = await Promise.all([
      getOciInstanceDetails(env),
      getOciPublicIp(env),
      checkPowerCooldown(env.DASH_KV),
    ]);

    const vmState: VmState = instanceDetails.lifecycleState;
    const computeUsage = instanceDetails.computeUsage;
    const publicIp = publicIpResult;

    // 2. Fetch Minecraft server status if public IP is available
    let mcOnline = false;
    let players = { online: 0, max: 0, names: [] as string[] };
    let version = 'Unknown';
    let motd = 'Unknown';

    if (publicIp && (vmState === 'RUNNING' || vmState === 'STARTING')) {
      const mcData = await getMinecraftStatus(env.DASH_KV, publicIp);
      mcOnline = mcData.online;
      players = mcData.players;
      version = mcData.version;
      motd = mcData.motd;
    }

    // 3. Determine Minecraft state:
    // "After the VM is RUNNING, Minecraft needs about 1-2 minutes, so show 'Starting up' until the status API reports online."
    let minecraftState: MinecraftState = 'Offline';
    if (mcOnline) {
      minecraftState = 'Online';
    } else if (vmState === 'STARTING' || vmState === 'RUNNING') {
      minecraftState = 'Starting up';
    } else {
      minecraftState = 'Offline';
    }

    // 4. Update online_since uptime tracking in KV
    let onlineSince = await env.DASH_KV.get(ONLINE_SINCE_KEY);
    if (mcOnline) {
      if (!onlineSince) {
        onlineSince = new Date().toISOString();
        await env.DASH_KV.put(ONLINE_SINCE_KEY, onlineSince);
      }
    } else {
      if (onlineSince) {
        await env.DASH_KV.delete(ONLINE_SINCE_KEY);
        onlineSince = null;
      }
    }

    // 5. Calculate Oracle trial days left
    let trialDaysLeft = 0;
    if (env.TRIAL_END) {
      try {
        const trialEndMs = new Date(env.TRIAL_END).getTime();
        const diffMs = trialEndMs - Date.now();
        trialDaysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      } catch {
        trialDaysLeft = 0;
      }
    }

    // 6. Fetch recent activity log
    const recentLog = await getRecentActivityLog(env.DASH_KV, 20);

    // 7. Check backup archive status
    let backupInfo: BackupInfo = {
      available: false,
      message: 'Configure Oracle Object Storage or start server for direct download.',
    };
    if (env.BACKUP_URL) {
      let downloadUrl = env.BACKUP_URL.trim();
      if (downloadUrl.endsWith('/')) {
        downloadUrl = `${downloadUrl}world-latest.tar.gz`;
      }
      try {
        const headRes = await fetch(downloadUrl, { method: 'HEAD' });
        if (headRes.ok) {
          const len = headRes.headers.get('content-length');
          backupInfo = {
            available: true,
            filename: 'world-latest.tar.gz',
            sizeBytes: len ? parseInt(len, 10) : undefined,
            lastModified: headRes.headers.get('last-modified') || undefined,
            message: 'Oracle Cloud save archive ready',
          };
        } else {
          backupInfo = {
            available: false,
            message: 'Oracle bucket connected. Awaiting world-latest.tar.gz upload from server.',
          };
        }
      } catch {
        backupInfo = {
          available: false,
          message: 'Error probing Oracle Object Storage URL.',
        };
      }
    } else if (publicIp && vmState === 'RUNNING') {
      backupInfo = {
        available: true,
        filename: 'world-latest.tar.gz',
        message: 'Direct server download ready (Server online)',
      };
    }

    const response: StatusResponse = {
      vmState,
      minecraftState,
      players,
      version,
      motd,
      address: publicIp ? `${publicIp}:25565` : '',
      onlineSince,
      trialDaysLeft,
      recentLog,
      powerCooldownSeconds: powerCooldown.onCooldown ? powerCooldown.remainingSeconds : 0,
      computeUsage,
      backupInfo,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve server status',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
