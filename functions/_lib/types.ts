export interface Env {
  DASH_KV: KVNamespace;
  BACKUP_BUCKET?: R2Bucket;
  BACKUP_URL?: string;
  OCI_TENANCY_OCID: string;
  OCI_USER_OCID: string;
  OCI_FINGERPRINT: string;
  OCI_PRIVATE_KEY_B64: string;
  OCI_REGION?: string;
  OCI_INSTANCE_OCID: string;
  OCI_COMPARTMENT_OCID: string;
  PASSWORD_HASH: string;
  SESSION_SECRET: string;
  TRIAL_END?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITEKEY?: string;
}

export type VmState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'Busy';
export type MinecraftState = 'Offline' | 'Starting up' | 'Online';

export interface PlayerInfo {
  online: number;
  max: number;
  names: string[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO date string
  action: 'START' | 'STOP' | 'RESTART' | 'LOGIN' | 'FAILED_LOGIN' | 'BACKUP_DOWNLOAD';
  result: 'SUCCESS' | 'FAILED';
  actor: string; // first 8 chars of SHA-256(client_ip)
  details?: string;
}

export interface BackupInfo {
  available: boolean;
  filename?: string;
  sizeBytes?: number;
  lastModified?: string;
  message?: string;
}

export interface ComputeUsage {
  shape: string;
  processor: string;
  ocpus: number;
  vcpus: number;
  memoryInGBs: number;
  networkGbps: number;
  estimatedHourlyCost: number; // in USD
  isAlwaysFreeShape: boolean;
  freeTierLimit: {
    maxOcpus: number;
    maxMemoryGBs: number;
  };
}

export interface StatusResponse {
  vmState: VmState;
  minecraftState: MinecraftState;
  players: PlayerInfo;
  version: string;
  motd: string;
  address: string;
  onlineSince: string | null;
  trialDaysLeft: number;
  recentLog: ActivityLogEntry[];
  powerCooldownSeconds?: number;
  computeUsage?: ComputeUsage;
  backupInfo?: BackupInfo;
}
