// Minecraft status lookup via mcsrvstat.us v3 with KV caching

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

const CACHE_TTL_SECONDS = 10;
const USER_AGENT = 'ServerControl/1.0';

export async function getMinecraftStatus(
  kv: KVNamespace,
  ip: string
): Promise<MinecraftStatusResult> {
  const cacheKey = `mcstatus_cache:${ip}`;

  // Check KV cache first
  try {
    const cached = await kv.get<MinecraftStatusResult>(cacheKey, 'json');
    if (cached) {
      return cached;
    }
  } catch (err) {
    console.error('Error reading mcstatus KV cache:', err);
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

    // Cache in KV for 10 seconds
    try {
      await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });
    } catch (cacheErr) {
      console.error('Failed to set mcstatus KV cache:', cacheErr);
    }

    return result;
  } catch (err) {
    // Failed to query or timeout, return graceful unknown
    console.error('mcsrvstat fetch error:', err);
    return fallback;
  }
}
