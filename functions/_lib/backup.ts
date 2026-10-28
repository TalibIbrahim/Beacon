// World save (backup) resolution shared by /api/status and /api/backup.
//
// Sources, in priority order:
//   1. R2 bucket binding BACKUP_BUCKET  -> streamed through this Function (HTTPS, behind the login)
//   2. BACKUP_URL (e.g. Oracle Object Storage pre-authenticated request) -> 302 redirect
//   3. The VM itself on port 8080 (scripts/serve-backup.sh) -> 302 redirect, only while the VM is RUNNING

import { BackupInfo, Env, VmState } from './types';

export const BACKUP_OBJECT = 'world-latest.tar.gz';

const PROBE_CACHE_KEY = 'backup_probe';
const PROBE_CACHE_TTL_SECONDS = 60;
const PROBE_TIMEOUT_MS = 5000;

export interface ResolvedBackup {
  info: BackupInfo;
  // Where /api/backup?download=1 should send the browser (url and vm sources only)
  redirectUrl?: string;
}

interface VmContext {
  vmState: VmState;
  publicIp: string | null;
}

interface ProbeResult {
  ok: boolean;
  sizeBytes?: number;
  lastModified?: string;
}

interface CachedProbe extends ProbeResult {
  url: string;
  checkedAt?: number; // epoch ms
}

export function getBackupUrl(env: Env): string | null {
  const raw = env.BACKUP_URL?.trim();
  if (!raw) return null;
  return raw.endsWith('/') ? `${raw}${BACKUP_OBJECT}` : raw;
}

export function getVmBackupUrl(env: Env, publicIp: string): string {
  const token = env.VM_BACKUP_TOKEN?.trim();
  const path = token ? `/${encodeURIComponent(token)}/${BACKUP_OBJECT}` : `/${BACKUP_OBJECT}`;
  return `http://${publicIp}:8080${path}`;
}

// Probe an external URL for the archive. HEAD first; some object stores refuse HEAD on
// pre-authenticated links, so fall back to a 1-byte ranged GET and read Content-Range.
async function probeUrl(url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (head.ok) {
      const len = head.headers.get('content-length');
      return {
        ok: true,
        sizeBytes: len ? parseInt(len, 10) : undefined,
        lastModified: head.headers.get('last-modified') || undefined,
      };
    }
    if (head.status === 404) return { ok: false };

    const ranged = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });
    // Do not download the body beyond the single byte we asked for
    await ranged.body?.cancel();
    if (ranged.status === 206 || ranged.ok) {
      const range = ranged.headers.get('content-range'); // bytes 0-0/123456
      const total = range?.split('/')[1];
      const len = ranged.headers.get('content-length');
      const sizeBytes = total && total !== '*' ? parseInt(total, 10) : ranged.status === 200 && len ? parseInt(len, 10) : undefined;
      return { ok: true, sizeBytes, lastModified: ranged.headers.get('last-modified') || undefined };
    }
    return { ok: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Cached for a minute so the 10-second dashboard poll does not hit the bucket every time.
// freshAfter (epoch ms, e.g. when arm-free last reported a backup) skips a cache entry from before
// then. That works in every Cloudflare location at once, unlike deleting the KV key.
async function probeUrlCached(env: Env, url: string, freshAfter = 0): Promise<ProbeResult | null> {
  try {
    const cached = await env.DASH_KV.get<CachedProbe>(PROBE_CACHE_KEY, 'json');
    if (cached && cached.url === url && (cached.checkedAt ?? 0) > freshAfter) return cached;
  } catch {
    // ignore KV errors
  }

  let result: ProbeResult;
  try {
    result = await probeUrl(url);
  } catch (err) {
    console.error('Backup URL probe failed:', err instanceof Error ? err.message : err);
    return null;
  }

  try {
    const entry: CachedProbe = { ...result, url, checkedAt: Date.now() };
    await env.DASH_KV.put(PROBE_CACHE_KEY, JSON.stringify(entry), {
      expirationTtl: PROBE_CACHE_TTL_SECONDS,
    });
  } catch {
    // ignore KV errors
  }
  return result;
}

export async function clearBackupProbeCache(env: Env): Promise<void> {
  try {
    await env.DASH_KV.delete(PROBE_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function resolveBackup(
  env: Env,
  getVm: () => Promise<VmContext>,
  freshAfter = 0
): Promise<ResolvedBackup> {
  // 1. Cloudflare R2
  if (env.BACKUP_BUCKET) {
    const obj = await env.BACKUP_BUCKET.head(BACKUP_OBJECT);
    if (!obj) {
      return {
        info: {
          available: false,
          source: 'r2',
          message: `R2 bucket is connected, but ${BACKUP_OBJECT} has not been uploaded yet. Run scripts/backup-world.sh on the VM.`,
        },
      };
    }
    return {
      info: {
        available: true,
        source: 'r2',
        verified: true,
        filename: BACKUP_OBJECT,
        sizeBytes: obj.size,
        lastModified: obj.uploaded.toISOString(),
        message: 'Stored in Cloudflare R2',
      },
    };
  }

  // 2. External URL (Oracle Object Storage pre-authenticated request, or any HTTPS link)
  const backupUrl = getBackupUrl(env);
  if (backupUrl) {
    const probe = await probeUrlCached(env, backupUrl, freshAfter);
    if (!probe) {
      return {
        info: {
          available: false,
          source: 'url',
          message: 'Could not reach BACKUP_URL. Check that the link is valid and has not expired.',
        },
      };
    }
    if (!probe.ok) {
      return {
        info: {
          available: false,
          source: 'url',
          message: `Bucket link works, but ${BACKUP_OBJECT} is not there yet. Press "Backup now", or run scripts/pack-and-upload.sh on arm-free.`,
        },
      };
    }
    return {
      info: {
        available: true,
        source: 'url',
        verified: true,
        filename: BACKUP_OBJECT,
        sizeBytes: probe.sizeBytes,
        lastModified: probe.lastModified,
        message: 'Stored in Oracle Object Storage',
      },
      redirectUrl: backupUrl,
    };
  }

  // 3. Straight from the VM. Workers cannot fetch bare IP addresses, so this cannot be
  // checked from here: it works only while scripts/serve-backup.sh is running.
  const { vmState, publicIp } = await getVm();
  if (vmState === 'RUNNING' && publicIp) {
    return {
      info: {
        available: true,
        source: 'vm',
        verified: false,
        filename: BACKUP_OBJECT,
        message: 'Served from the VM on port 8080 while scripts/serve-backup.sh is running.',
      },
      redirectUrl: getVmBackupUrl(env, publicIp),
    };
  }

  return {
    info: {
      available: false,
      source: 'none',
      message: 'No backup storage is set up, and the server is off. Connect an R2 bucket or set BACKUP_URL so saves are reachable while the VM is stopped.',
    },
  };
}
