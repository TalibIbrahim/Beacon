// Minecraft status lookup via mcsrvstat.us v3 with a short in-memory cache.
// Not KV: the dashboard polls every 10s, and KV's minimum TTL (60s) plus its 1,000 writes/day free
// limit would both be hit. The cache lives per isolate, so it only absorbs bursts.

export interface MinecraftStatusResult {
  online: boolean;
  players: {
    online: number;
    max: number;
    names: string[];
  };
  version: string;
  motd: string;
  rawError?: boolean;
}

const CACHE_TTL_MS = 10_000;
const USER_AGENT = 'ServerControl/1.0';

let cached: { ip: string; at: number; result: MinecraftStatusResult } | null = null;

// `fresh` skips the cache: used where the answer gates an action (stopping or restoring with players on)
export async function getMinecraftStatus(
  ip: string,
  options: { fresh?: boolean } = {}
): Promise<MinecraftStatusResult> {
  if (!options.fresh && cached && cached.ip === ip && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  // Fallback default if fetch fails
  const fallback: MinecraftStatusResult = {
    online: false,
    players: { online: 0, max: 0, names: [] },
    version: 'Unknown',
    motd: 'Unknown',
    rawError: true,
  };

  try {
    // Abort after 5 seconds to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}:25565`, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json() as any;
    const isOnline = Boolean(data && data.online);

    // Extract player names
    const playerNames: string[] = [];
    if (data?.players?.list && Array.isArray(data.players.list)) {
      for (const item of data.players.list) {
        if (typeof item === 'string') {
          playerNames.push(item);
        } else if (item && typeof item.name === 'string') {
          playerNames.push(item.name);
        }
      }
    }

    // Extract MOTD
    let cleanMotd = 'Unknown';
    if (Array.isArray(data?.motd?.clean) && data.motd.clean.length > 0) {
      cleanMotd = data.motd.clean.join(' \n ');
    } else if (typeof data?.motd?.clean === 'string') {
      cleanMotd = data.motd.clean;
    }

    const result: MinecraftStatusResult = {
      online: isOnline,
      players: {
        online: typeof data?.players?.online === 'number' ? data.players.online : 0,
        max: typeof data?.players?.max === 'number' ? data.players.max : 0,
        names: playerNames,
      },
      version: data?.version || (isOnline ? 'Minecraft' : 'Unknown'),
      motd: cleanMotd,
      rawError: false,
    };

    // Only successful lookups are cached; a failed one is retried on the next call
    cached = { ip, at: Date.now(), result };

    return result;
  } catch (err) {
    // Failed to query or timeout, return graceful unknown
    console.error('mcsrvstat fetch error:', err);
    return fallback;
  }
}
