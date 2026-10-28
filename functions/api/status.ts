// GET /api/status - Retrieve VM state, Minecraft server status, players, and logs

import { getRecentActivityLog } from '../_lib/log';
import { getMinecraftStatus } from '../_lib/mcstatus';
import { getOciInstanceDetails, getOciPublicIp } from '../_lib/oci';
import { checkPowerCooldown } from '../_lib/ratelimit';
import { ResolvedBackup, resolveBackup } from '../_lib/backup';
import { getBackupJobInfo } from '../_lib/backupjob';
import { BackupJobInfo, Env, MinecraftState, StatusResponse, VmState } from '../_lib/types';

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

    // 5. Days left on the Oracle trial (null when TRIAL_END is not set)
    let trialDaysLeft: number | null = null;
    if (env.TRIAL_END) {
      const trialEndMs = new Date(env.TRIAL_END).getTime();
      if (!isNaN(trialEndMs)) {
        trialDaysLeft = Math.max(0, Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24)));
      }
    }

    // 6. Recent activity log, world save and arm-free backups, in parallel
    const [recentLog, backup, backupJob] = await Promise.all([
      getRecentActivityLog(env.DASH_KV, 20),
      resolveBackup(env, async () => ({ vmState, publicIp })).catch((err): ResolvedBackup => {
        console.error('Backup resolution failed:', err instanceof Error ? err.message : err);
        return { info: { available: false, source: 'none', message: 'Could not check the backup storage.' } };
      }),
      getBackupJobInfo(env, { vmState, onlineSince }).catch((err): BackupJobInfo | undefined => {
        console.error('Backup job status failed:', err instanceof Error ? err.message : err);
        return undefined;
      }),
    ]);

    const response: StatusResponse = {
      vmState,
      minecraftState,
      players,
      version,
      motd,
      address: publicIp ? `${publicIp}:25565` : '',
      onlineSince,
      region: env.OCI_REGION || 'me-dubai-1',
      trialDaysLeft,
      recentLog,
      powerCooldownSeconds: powerCooldown.onCooldown ? powerCooldown.remainingSeconds : 0,
      computeUsage,
      backupInfo: backup.info,
      backupJob,
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
