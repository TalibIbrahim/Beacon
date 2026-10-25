// Oracle Cloud Infrastructure (OCI) REST Client with Request Signing (RFC / Draft-Cavage)
// Uses Web Crypto only (RSASSA-PKCS1-v1_5 + SHA-256).

import { base64ToUint8Array, uint8ArrayToBase64 } from './auth';
import { ComputeUsage, Env, VmState } from './types';

// TODO(verify): Verify whether OCI_PRIVATE_KEY_B64 is provided as base64-encoded PEM string or direct base64 DER.
// Also verify that the OCI private key is in PKCS#8 format (generated or converted via `openssl pkcs8 -topk8 -nocrypt`).

let cachedPrivateKey: CryptoKey | null = null;
let cachedKeyB64Raw: string | null = null;

/**
 * Import the PKCS#8 private key from env OCI_PRIVATE_KEY_B64 using Web Crypto.
 */
export async function getOciPrivateKey(keyB64: string): Promise<CryptoKey> {
  if (cachedPrivateKey && cachedKeyB64Raw === keyB64) {
    return cachedPrivateKey;
  }

  const raw = keyB64.trim();
  let pemText = '';

  try {
    const decoded = atob(raw.replace(/\s+/g, ''));
    if (decoded.includes('-----BEGIN')) {
      pemText = decoded;
    }
  } catch {
    // raw was not base64-encoded string, might be raw PEM or direct DER
  }

  if (!pemText && raw.includes('-----BEGIN')) {
    pemText = raw;
  }

  let derBytes: Uint8Array;
  if (pemText) {
    // Extract base64 DER between PEM headers and footers
    const match = pemText.match(/-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/);
    if (match) {
      const derBase64 = match[1].replace(/\s+/g, '');
      derBytes = base64ToUint8Array(derBase64);
    } else {
      const cleaned = pemText
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
      derBytes = base64ToUint8Array(cleaned);
    }
  } else {
    // Already base64-encoded DER
    derBytes = base64ToUint8Array(raw);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes.buffer as ArrayBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  cachedPrivateKey = cryptoKey;
  cachedKeyB64Raw = keyB64;
  return cryptoKey;
}

/**
 * Perform a signed OCI REST API request.
 * Log only HTTP status and OCI error code, never keys or headers.
 */
export async function ociFetch(
  env: Env,
  method: 'GET' | 'POST',
  pathWithQuery: string,
  body: string = ''
): Promise<Response> {
  const region = env.OCI_REGION || 'me-dubai-1';
  const host = `iaas.${region}.oraclecloud.com`;
  const url = `https://${host}${pathWithQuery}`;

  const keyId = `${env.OCI_TENANCY_OCID}/${env.OCI_USER_OCID}/${env.OCI_FINGERPRINT}`;
  const privateKey = await getOciPrivateKey(env.OCI_PRIVATE_KEY_B64);

  // Determine if runtime allows setting the 'date' header or requires 'x-date'
  let dateHeaderName = 'date';
  try {
    const test = new Headers();
    test.set('date', new Date().toUTCString());
    if (!test.has('date')) {
      dateHeaderName = 'x-date';
    }
  } catch {
    dateHeaderName = 'x-date';
  }

  const dateValue = new Date().toUTCString();

  const reqHeaders: Record<string, string> = {};
  reqHeaders[dateHeaderName] = dateValue;

  let headersToSign: string[];
  let signingString = '';

  if (method === 'GET') {
    // Headers to sign for GET: date (request-target) host
    headersToSign = [dateHeaderName, '(request-target)', 'host'];
    signingString = `${dateHeaderName}: ${dateValue}\n(request-target): get ${pathWithQuery}\nhost: ${host}`;
  } else {
    // POST request
    const bodyBytes = new TextEncoder().encode(body);
    const bodyDigest = await crypto.subtle.digest('SHA-256', bodyBytes);
    const contentSha256 = uint8ArrayToBase64(new Uint8Array(bodyDigest));
    const contentType = 'application/json';
    const contentLength = bodyBytes.byteLength.toString();

    reqHeaders['x-content-sha256'] = contentSha256;
    reqHeaders['content-type'] = contentType;
    reqHeaders['content-length'] = contentLength;

    // Headers to sign for POST: (request-target) host date x-content-sha256 content-type content-length
    headersToSign = [
      '(request-target)',
      'host',
      dateHeaderName,
      'x-content-sha256',
      'content-type',
      'content-length',
    ];

    signingString =
      `(request-target): post ${pathWithQuery}\n` +
      `host: ${host}\n` +
      `${dateHeaderName}: ${dateValue}\n` +
      `x-content-sha256: ${contentSha256}\n` +
      `content-type: ${contentType}\n` +
      `content-length: ${contentLength}`;
  }

  // Sign string with RSASSA-PKCS1-v1_5 + SHA-256
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingString)
  );
  const signatureBase64 = uint8ArrayToBase64(new Uint8Array(signatureBuffer));

  const authHeader = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(
    ' '
  )}",signature="${signatureBase64}"`;

  reqHeaders['authorization'] = authHeader;

  // Execute request
  const fetchOptions: RequestInit = {
    method,
    headers: reqHeaders,
  };

  if (method === 'POST') {
    fetchOptions.body = body;
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    // Safely parse OCI error code without logging headers or secrets
    let ociCode = 'Unknown';
    try {
      const cloned = response.clone();
      const errJson = (await cloned.json()) as any;
      if (errJson && errJson.code) {
        ociCode = String(errJson.code);
      }
    } catch {
      // Non-JSON body
    }
    console.error(`OCI error: HTTP ${response.status}, code: ${ociCode}`);
  }

  return response;
}

/**
 * Fetch instance details and hardware specs from OCI
 * Endpoints: GET /20160918/instances/{instanceId}
 */
export async function getOciInstanceDetails(env: Env): Promise<{
  lifecycleState: VmState;
  computeUsage?: ComputeUsage;
}> {
  const path = `/20160918/instances/${encodeURIComponent(env.OCI_INSTANCE_OCID)}`;
  const res = await ociFetch(env, 'GET', path);

  if (!res.ok) {
    return { lifecycleState: 'Busy' };
  }

  const data = (await res.json()) as any;
  const rawState = (data.lifecycleState || '').toUpperCase();

  let lifecycleState: VmState = 'Busy';
  switch (rawState) {
    case 'STOPPED':
      lifecycleState = 'STOPPED';
      break;
    case 'STARTING':
    case 'PROVISIONING':
      lifecycleState = 'STARTING';
      break;
    case 'RUNNING':
      lifecycleState = 'RUNNING';
      break;
    case 'STOPPING':
    case 'TERMINATING':
      lifecycleState = 'STOPPING';
      break;
    default:
      lifecycleState = 'Busy';
  }

  const shape = data.shape || 'Unknown';
  const shapeConfig = data.shapeConfig || {};
  const ocpus = typeof shapeConfig.ocpus === 'number' ? shapeConfig.ocpus : 2;
  const vcpus = typeof shapeConfig.vcpus === 'number' ? shapeConfig.vcpus : 4;
  const memoryInGBs = typeof shapeConfig.memoryInGBs === 'number' ? shapeConfig.memoryInGBs : 12;
  const processor = shapeConfig.processorDescription || (shape.includes('A1') ? 'Ampere Altra' : 'AMD EPYC');
  const networkGbps = typeof shapeConfig.networkingBandwidthInGbps === 'number' ? shapeConfig.networkingBandwidthInGbps : 2;

  const isAlwaysFreeShape = shape.includes('A1') || shape.includes('Micro');

  // OCI Pricing: VM.Standard.E5.Flex is ~$0.03/OCPU-hr and ~$0.0015/GB-hr
  const estimatedHourlyCost = isAlwaysFreeShape
    ? 0
    : Number((ocpus * 0.03 + memoryInGBs * 0.0015).toFixed(4));

  const computeUsage: ComputeUsage = {
    shape,
    processor,
    ocpus,
    vcpus,
    memoryInGBs,
    networkGbps,
    estimatedHourlyCost,
    isAlwaysFreeShape,
    freeTierLimit: {
      maxOcpus: 4,
      maxMemoryGBs: 24,
    },
  };

  return { lifecycleState, computeUsage };
}

/**
 * Fetch instance lifecycle state from OCI
 */
export async function getOciInstanceLifecycleState(env: Env): Promise<VmState> {
  const details = await getOciInstanceDetails(env);
  return details.lifecycleState;
}

/**
 * Trigger OCI power action on instance
 * Action: START | SOFTSTOP | SOFTRESET
 * Endpoint: POST /20160918/instances/{instanceId}?action=...
 */
export async function sendOciPowerAction(
  env: Env,
  action: 'START' | 'SOFTSTOP' | 'SOFTRESET'
): Promise<{ success: boolean; status: number; ociCode?: string }> {
  const path = `/20160918/instances/${encodeURIComponent(
    env.OCI_INSTANCE_OCID
  )}?action=${action}`;

  // Empty body for power action
  const res = await ociFetch(env, 'POST', path, '');

  if (!res.ok) {
    let ociCode: string | undefined;
    try {
      const errJson = (await res.json()) as any;
      if (errJson?.code) {
        ociCode = String(errJson.code);
      }
    } catch {
      // ignore
    }
    return { success: false, status: res.status, ociCode };
  }

  return { success: true, status: res.status };
}

/**
 * Resolve public IP for the instance via VNIC lookup
 * 1) GET /20160918/vnicAttachments?compartmentId={compartmentId}&instanceId={instanceId}
 * 2) GET /20160918/vnics/{vnicId} -> read publicIp
 */
export async function getOciPublicIp(env: Env): Promise<string | null> {
  const kvCacheKey = `oci_vnic_ip:${env.OCI_INSTANCE_OCID}`;

  // Check KV cache for the public IP (cached for 60 seconds to save OCI API calls)
  try {
    const cachedIp = await env.DASH_KV.get(kvCacheKey);
    if (cachedIp) {
      return cachedIp;
    }
  } catch {
    // ignore KV errors
  }

  const vnicAttachPath = `/20160918/vnicAttachments?compartmentId=${encodeURIComponent(
    env.OCI_COMPARTMENT_OCID
  )}&instanceId=${encodeURIComponent(env.OCI_INSTANCE_OCID)}`;

  const attachRes = await ociFetch(env, 'GET', vnicAttachPath);
  if (!attachRes.ok) {
    return null;
  }

  const attachments = (await attachRes.json()) as Array<{
    lifecycleState: string;
    vnicId: string;
  }>;

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  // Find the attached VNIC
  const attached = attachments.find(
    (a) => (a.lifecycleState || '').toUpperCase() === 'ATTACHED'
  ) || attachments[0];

  if (!attached || !attached.vnicId) {
    return null;
  }

  const vnicPath = `/20160918/vnics/${encodeURIComponent(attached.vnicId)}`;
  const vnicRes = await ociFetch(env, 'GET', vnicPath);
  if (!vnicRes.ok) {
    return null;
  }

  const vnicData = (await vnicRes.json()) as { publicIp?: string };
  const publicIp = vnicData.publicIp || null;

  if (publicIp) {
    try {
      await env.DASH_KV.put(kvCacheKey, publicIp, { expirationTtl: 60 });
    } catch {
      // ignore
    }
  }

  return publicIp;
}
