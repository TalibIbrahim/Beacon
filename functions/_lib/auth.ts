// Authentication and Session Management using Web Crypto only

export const SESSION_COOKIE_NAME = '__Host-mcdash';
export const SESSION_DURATION_SECONDS = 8 * 3600; // 8 hours

export interface SessionPayload {
  iat: number;
  exp: number;
}

// Convert base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to base64
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64URL encoding/decoding
export function base64UrlEncode(bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64ToUint8Array(base64);
}

// Constant-time byte array equality check to prevent timing attacks
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// Verify PBKDF2 password hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Format: pbkdf2$100000$<saltBase64>$<hashBase64>
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      await dummyVerifyPassword(password);
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const saltBase64 = parts[2];
    const expectedHashBase64 = parts[3];

    if (isNaN(iterations) || iterations <= 0 || !saltBase64 || !expectedHashBase64) {
      await dummyVerifyPassword(password);
      return false;
    }

    const salt = base64ToUint8Array(saltBase64);
    const expectedHash = base64ToUint8Array(expectedHashBase64);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      expectedHash.length * 8
    );

    const derivedBytes = new Uint8Array(derivedBits);
    return timingSafeEqual(derivedBytes, expectedHash);
  } catch {
    await dummyVerifyPassword(password);
    return false;
  }
}

// Dummy PBKDF2 derivation so response time is identical when locked out or invalid format
export async function dummyVerifyPassword(password: string): Promise<void> {
  try {
    const dummySalt = new Uint8Array(16);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: dummySalt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
  } catch {
    // Ignore dummy errors
  }
}

// Session HMAC key helper
async function getHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// Create signed session cookie token
export async function createSessionToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64)
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${payloadB64}.${sigB64}`;
}

// Verify session token
export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, sigB64] = parts;
    const key = await getHmacKey(secret);

    const actualSig = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      actualSig,
      new TextEncoder().encode(payloadB64)
    );

    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Helper to extract session cookie
export function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return valParts.join('=');
    }
  }
  return null;
}

// Helper to build Set-Cookie header value
export function buildSetCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`;
}

// Helper to build expired Set-Cookie header for logout
export function buildClearCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// Masked client identifier (first 8 hex characters of SHA-256 of IP)
export async function getMaskedActor(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.substring(0, 8);
}
