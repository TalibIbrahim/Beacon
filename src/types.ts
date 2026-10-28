export type VmState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'Busy';
export type MinecraftState = 'Offline' | 'Starting up' | 'Online';

export interface PlayerInfo {
  online: number;
  max: number;
  names: string[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
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
  actor: string;
  details?: string;
}

export type BackupSource = 'r2' | 'url' | 'vm' | 'none';

export interface BackupInfo {
  available: boolean;
  source: BackupSource;
  verified?: boolean;
  filename?: string;
  sizeBytes?: number;
  lastModified?: string;
  message?: string;
}

export type BackupRequestState = 'pending' | 'running' | 'done' | 'failed';

export interface BackupJobInfo {
  configured: boolean;
  message?: string;
  agent: {
    lastSeen: string | null;
    responding: boolean;
    busy: boolean;
    cronActive: boolean | null;
    scheduleInstalled: boolean | null;
  };
  lastBackupAt: string | null;
  lastBackupBytes: number | null;
  lastRun: {
    trigger: 'requested' | 'scheduled';
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
  overdue: boolean;
}

export interface ComputeUsage {
  shape: string;
  processor: string;
  ocpus: number;
  vcpus: number;
  memoryInGBs: number;
  networkGbps: number;
  estimatedHourlyCost: number;
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
  trialDaysLeft: number | null;
  recentLog: ActivityLogEntry[];
  powerCooldownSeconds?: number;
  computeUsage?: ComputeUsage;
  backupInfo?: BackupInfo;
  backupJob?: BackupJobInfo;
  leaderboard?: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  name: string; // untrusted (offline mode): render as text only
  totalMs: number;
  sessions: number;
  lastSeen: string;
  online: boolean;
}

export type PowerAction = 'start' | 'stop' | 'restart';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
