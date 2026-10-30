// GET /api/backup              - Where the world save is and whether it can be downloaded
// GET /api/backup?download=1   - Download it (streamed from R2, or redirected to the bucket link / VM)
//
// The Object Storage zip names itself: pack-and-upload.sh stores its Content-Disposition with it.

import { getMaskedActor } from '../_lib/auth';
import { LEGACY_BACKUP_OBJECT, resolveBackup } from '../_lib/backup';
import { addActivityLog } from '../_lib/log';
import { getOciInstanceLifecycleState, getOciPublicIp } from '../_lib/oci';
import { Env } from '../_lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function downloadFilename(lastModified?: string): string {
  const date = lastModified ? new Date(lastModified) : new Date();
  const stamp = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  return `minecraft-world-${stamp.slice(0, 10)}.tar.gz`;
}

function formatSize(bytes?: number): string | null {
  if (!bytes) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const isDownload = new URL(request.url).searchParams.get('download') === '1';

  if (!env.DASH_KV) {
    return json(
      {
        error: "KV storage is not connected. Add a KV namespace binding named 'DASH_KV'.",
      },
      500
    );
  }

  try {
    const { info, redirectUrl } = await resolveBackup(env, async () => {
      const [vmState, publicIp] = await Promise.all([
        getOciInstanceLifecycleState(env),
        getOciPublicIp(env),
      ]);
      return { vmState, publicIp };
    });

    if (!isDownload) {
      return json(info);
    }

    if (!info.available) {
      return json({ error: info.message || 'No world save is available to download.' }, 404);
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    const actor = await getMaskedActor(clientIp);

    // R2: stream the object through this Function so the download stays on HTTPS and behind the login
    if (info.source === 'r2' && env.BACKUP_BUCKET) {
      const obj = await env.BACKUP_BUCKET.get(LEGACY_BACKUP_OBJECT);
      if (!obj) {
        return json({ error: 'The world save disappeared from the bucket. Try again in a moment.' }, 404);
      }

      await addActivityLog(env.DASH_KV, {
        action: 'BACKUP_DOWNLOAD',
        result: 'SUCCESS',
        actor,
        details: `R2 · ${formatSize(obj.size) ?? 'unknown size'}`,
      });

      return new Response(obj.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': obj.size.toString(),
          'Content-Disposition': `attachment; filename="${downloadFilename(info.lastModified)}"`,
          ETag: obj.httpEtag,
        },
      });
    }

    if (!redirectUrl) {
      return json({ error: 'No download location is configured.' }, 500);
    }

    await addActivityLog(env.DASH_KV, {
      action: 'BACKUP_DOWNLOAD',
      result: 'SUCCESS',
      actor,
      details:
        info.source === 'url'
          ? `Object Storage · ${formatSize(info.sizeBytes) ?? 'unknown size'}`
          : 'Direct from VM',
    });

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Backup endpoint error:', error instanceof Error ? error.message : error);
    return json({ error: 'Failed to reach the backup storage.' }, 500);
  }
};
