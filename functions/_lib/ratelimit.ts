// Rate limiting and brute force protection using Cloudflare KV

export interface RateLimitStatus {
  isLocked: boolean;
  retryAfter: number; // in seconds
  reason?: 'ip' | 'global';
}

interface CounterRecord {
  count: number;
  lockedUntil?: number; // epoch ms
  firstSeen: number;    // epoch ms
}

const IP_MAX_ATTEMPTS = 5;
const IP_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const IP_WINDOW_SECONDS = 15 * 60; // 15 minutes TTL

const GLOBAL_MAX_ATTEMPTS = 25;
const GLOBAL_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const GLOBAL_WINDOW_SECONDS = 60 * 60; // 1 hour TTL

const POWER_COOLDOWN_MS = 30 * 1000; // 30 seconds
const POWER_COOLDOWN_KEY = 'cooldown:power';

// Check if login is currently locked for IP or globally
export async function checkLoginRateLimit(kv: KVNamespace, ip: string): Promise<RateLimitStatus> {
  const now = Date.now();
  const ipKey = `rate:ip:${ip}`;
  const globalKey = `rate:global`;

  const [ipData, globalData] = await Promise.all([
    kv.get<CounterRecord>(ipKey, 'json'),
    kv.get<CounterRecord>(globalKey, 'json'),
  ]);

  // Check IP lockout
  if (ipData?.lockedUntil && ipData.lockedUntil > now) {
    const retryAfter = Math.ceil((ipData.lockedUntil - now) / 1000);
    return { isLocked: true, retryAfter, reason: 'ip' };
  }

  // Check global lockout
  if (globalData?.lockedUntil && globalData.lockedUntil > now) {
    const retryAfter = Math.ceil((globalData.lockedUntil - now) / 1000);
    return { isLocked: true, retryAfter, reason: 'global' };
  }

  return { isLocked: false, retryAfter: 0 };
}

// Record a failed login attempt for both IP and global counters
export async function recordFailedLogin(kv: KVNamespace, ip: string): Promise<RateLimitStatus> {
  const now = Date.now();
  const ipKey = `rate:ip:${ip}`;
  const globalKey = `rate:global`;

  const [ipData, globalData] = await Promise.all([
    kv.get<CounterRecord>(ipKey, 'json'),
    kv.get<CounterRecord>(globalKey, 'json'),
  ]);

  // Update IP counter
  let newIpCount = (ipData?.count || 0) + 1;
  let ipLockedUntil = ipData?.lockedUntil;
  if (newIpCount >= IP_MAX_ATTEMPTS) {
    ipLockedUntil = now + IP_LOCK_DURATION_MS;
  }

  const updatedIpRecord: CounterRecord = {
    count: newIpCount,
    lockedUntil: ipLockedUntil,
    firstSeen: ipData?.firstSeen || now,
  };

  // Update global counter
  let newGlobalCount = (globalData?.count || 0) + 1;
  let globalLockedUntil = globalData?.lockedUntil;
  if (newGlobalCount >= GLOBAL_MAX_ATTEMPTS) {
    globalLockedUntil = now + GLOBAL_LOCK_DURATION_MS;
  }

  const updatedGlobalRecord: CounterRecord = {
    count: newGlobalCount,
    lockedUntil: globalLockedUntil,
    firstSeen: globalData?.firstSeen || now,
  };

  await Promise.all([
    kv.put(ipKey, JSON.stringify(updatedIpRecord), { expirationTtl: IP_WINDOW_SECONDS }),
    kv.put(globalKey, JSON.stringify(updatedGlobalRecord), { expirationTtl: GLOBAL_WINDOW_SECONDS }),
  ]);

  if (ipLockedUntil && ipLockedUntil > now) {
    return { isLocked: true, retryAfter: Math.ceil((ipLockedUntil - now) / 1000), reason: 'ip' };
  }
  if (globalLockedUntil && globalLockedUntil > now) {
    return { isLocked: true, retryAfter: Math.ceil((globalLockedUntil - now) / 1000), reason: 'global' };
  }

  return { isLocked: false, retryAfter: 0 };
}

// Reset failed login counter for an IP upon successful login
export async function resetLoginRateLimit(kv: KVNamespace, ip: string): Promise<void> {
  await kv.delete(`rate:ip:${ip}`);
}

// Check power action cooldown (30 seconds)
export async function checkPowerCooldown(kv: KVNamespace): Promise<{ onCooldown: boolean; remainingSeconds: number }> {
  const raw = await kv.get(POWER_COOLDOWN_KEY);
  if (!raw) {
    return { onCooldown: false, remainingSeconds: 0 };
  }

  const lastPowerTime = parseInt(raw, 10);
  if (isNaN(lastPowerTime)) {
    return { onCooldown: false, remainingSeconds: 0 };
  }

  const elapsed = Date.now() - lastPowerTime;
  if (elapsed < POWER_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((POWER_COOLDOWN_MS - elapsed) / 1000);
    return { onCooldown: true, remainingSeconds };
  }

  return { onCooldown: false, remainingSeconds: 0 };
}

// Set power action cooldown after successful power action
export async function recordPowerActionCooldown(kv: KVNamespace): Promise<void> {
  await kv.put(POWER_COOLDOWN_KEY, Date.now().toString(), { expirationTtl: 60 });
}
