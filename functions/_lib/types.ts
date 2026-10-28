export interface Env {
  DASH_KV: KVNamespace;
  BACKUP_BUCKET?: R2Bucket;
  BACKUP_URL?: string;
  VM_BACKUP_TOKEN?: string;
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
  // D1: the arm-free agent, events, playtime, snapshots, restores (schema in migrations/)
  DASH_DB?: D1Database;
  AGENT_TOKEN?: string;
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
  action:
    | 'START'
    | 'STOP'
    | 'RESTART'
    | 'LOGIN'
    | 'FAILED_LOGIN'
    | 'BACKUP_DOWNLOAD'
    | 'BACKUP_REQUEST'
    | 'BACKUP_RUN';
  result: 'SUCCESS' | 'FAILED';
  actor: string; // first 8 chars of SHA-256(client_ip)
  details?: string;
}

export type BackupSource = 'r2' | 'url' | 'vm' | 'none';

export interface BackupInfo {
  available: boolean;
  source: BackupSource;
  // false when the archive could not be checked (the VM source)
  verified?: boolean;
  filename?: string;
  sizeBytes?: number;
  lastModified?: string;
  message?: string;
}

export type BackupRequestState = 'pending' | 'running' | 'done' | 'failed';
export type BackupTrigger = 'requested' | 'scheduled';

// Backups made by the agent on arm-free (mc-agent.sh), as shown in the Backups panel
export interface BackupJobInfo {
  // false until DASH_DB is bound and AGENT_TOKEN is set
  configured: boolean;
  message?: string;
  agent: {
    lastSeen: string | null;
    // a heartbeat in the last 3 minutes
    responding: boolean;
    // a backup (requested or scheduled) holds the lock right now
    busy: boolean;
    cronActive: boolean | null;
    scheduleInstalled: boolean | null;
  };
  lastBackupAt: string | null;
  lastBackupBytes: number | null;
  lastRun: {
    trigger: BackupTrigger;
    ok: boolean;
    finishedAt: string;
    sizeBytes?: number;
    error?: string;
  } | null;
  request: {
    state: BackupRequestState;
    requestedAt: string;
    startedAt?: string;
    finishedAt?: string;
    sizeBytes?: number;
    error?: string;
  } | null;
  cooldownSeconds: number;
  // last backup older than 90 minutes while the premium VM is running
  overdue: boolean;
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
  region: string;
  // null when TRIAL_END is not configured
  trialDaysLeft: number | null;
  recentLog: ActivityLogEntry[];
  powerCooldownSeconds?: number;
  computeUsage?: ComputeUsage;
  backupInfo?: BackupInfo;
  backupJob?: BackupJobInfo;
}
