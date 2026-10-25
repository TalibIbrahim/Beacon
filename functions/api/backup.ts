// GET /api/backup - Query backup status or stream/redirect download

import { addActivityLog } from '../_lib/log';
import { getOciPublicIp } from '../_lib/oci';
import { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const isDownload = url.searchParams.get('download') === '1';

  try {
    // Priority 1: Oracle Cloud Object Storage PAR URL or external URL
    if (env.BACKUP_URL) {
      let downloadUrl = env.BACKUP_URL.trim();
      if (downloadUrl.endsWith('/')) {
        downloadUrl = `${downloadUrl}world-latest.tar.gz`;
      }

      // Probe Oracle Object Storage with HEAD
      let fileExists = false;
      let sizeBytes: number | undefined;
      let lastModified: string | undefined;

      try {
        const headRes = await fetch(downloadUrl, { method: 'HEAD' });
        if (headRes.ok) {
          fileExists = true;
          const len = headRes.headers.get('content-length');
          if (len) sizeBytes = parseInt(len, 10);
          lastModified = headRes.headers.get('last-modified') || undefined;
        }
      } catch (err) {
        console.error('Failed to probe Oracle backup URL:', err);
      }

      if (isDownload) {
        if (!fileExists) {
          return new Response(
            JSON.stringify({
              error: 'No backup found in Oracle bucket yet. Upload world-latest.tar.gz from your server first.',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        try {
          const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
          const rawHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIp));
          const hashHex = Array.from(new Uint8Array(rawHash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 8);

          if (env.DASH_KV) {
            await addActivityLog(env.DASH_KV, {
              action: 'BACKUP_DOWNLOAD',
              result: 'SUCCESS',
              actor: hashHex,
              details: `Downloaded world save (${sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Oracle Cloud'})`,
            });
          }
        } catch (logErr) {
          console.error('Failed to log backup download:', logErr);
        }

        return Response.redirect(downloadUrl, 302);
      }

      return new Response(
        JSON.stringify({
          available: fileExists,
          filename: 'world-latest.tar.gz',
          sizeBytes,
          lastModified,
          message: fileExists
            ? 'Oracle Cloud save archive ready for download'
            : 'Oracle bucket connected, but no backup uploaded yet. Run backup command on server.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Priority 2: Direct download from Oracle VM if running
    const publicIp = await getOciPublicIp(env);
    if (publicIp) {
      const vmDownloadUrl = `http://${publicIp}:8080/world-latest.tar.gz`;

      if (isDownload) {
        try {
          const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
          const rawHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIp));
          const hashHex = Array.from(new Uint8Array(rawHash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 8);

          if (env.DASH_KV) {
            await addActivityLog(env.DASH_KV, {
              action: 'BACKUP_DOWNLOAD',
              result: 'SUCCESS',
              actor: hashHex,
              details: 'Initiated direct world save download from server',
            });
          }
        } catch (logErr) {
          console.error('Failed to log direct download:', logErr);
        }

        return Response.redirect(vmDownloadUrl, 302);
      }

      return new Response(
        JSON.stringify({
          available: true,
          filename: 'world-latest.tar.gz',
          message: 'Direct server download available (Server is running)',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Priority 3: No backup source configured and server is not running
    return new Response(
      JSON.stringify({
        available: false,
        message: 'Server is stopped and no backup URL is configured. Start the server to download or configure Oracle Object Storage.',
      }),
      {
        status: isDownload ? 404 : 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Backup endpoint error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to access backup service',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
