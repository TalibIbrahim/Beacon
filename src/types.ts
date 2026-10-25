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
  action: 'START' | 'STOP' | 'RESTART' | 'LOGIN' | 'FAILED_LOGIN' | 'BACKUP_DOWNLOAD';
  result: 'SUCCESS' | 'FAILED';
  actor: string;
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
  trialDaysLeft: number;
  recentLog: ActivityLogEntry[];
  powerCooldownSeconds?: number;
  computeUsage?: ComputeUsage;
  backupInfo?: BackupInfo;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
