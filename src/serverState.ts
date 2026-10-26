// One place that turns the VM state + Minecraft state into what the screen says

import { formatDuration, plural } from './format';
import { StatusResponse } from './types';

export type Phase = 'off' | 'booting' | 'loading' | 'online' | 'stopping' | 'unknown';

// The boot track: the four stations a start walks through
export const STATIONS = [
  { phase: 'off', label: 'Off', short: 'Off', detail: 'VM stopped' },
  { phase: 'booting', label: 'VM booting', short: 'VM', detail: 'Oracle Cloud' },
  { phase: 'loading', label: 'Loading world', short: 'World', detail: 'Minecraft' },
  { phase: 'online', label: 'Online', short: 'Online', detail: 'Ready to join' },
] as const;

export function getPhase(status: Pick<StatusResponse, 'vmState' | 'minecraftState'>): Phase {
  if (status.minecraftState === 'Online') return 'online';
  switch (status.vmState) {
    case 'STOPPED':
      return 'off';
    case 'STARTING':
      return 'booting';
    case 'RUNNING':
      return 'loading';
    case 'STOPPING':
      return 'stopping';
    default:
      return 'unknown';
  }
}

// Index on the boot track; stopping sits on "Off" as the station it is heading for
export function stationIndex(phase: Phase): number {
  if (phase === 'stopping') return 0;
  return STATIONS.findIndex((s) => s.phase === phase);
}

export const PHASE_WORD: Record<Phase, string> = {
  off: 'Off',
  booting: 'Starting',
  loading: 'Starting',
  online: 'Online',
  stopping: 'Shutting down',
  unknown: 'Unknown',
};

export function isTransitional(phase: Phase): boolean {
  return phase === 'booting' || phase === 'loading' || phase === 'stopping';
}

// The line under the page title: the one thing worth knowing right now
export function getFinding(status: StatusResponse, now = Date.now()): string {
  const phase = getPhase(status);
  switch (phase) {
    case 'online': {
      const parts: string[] = [];
      if (status.onlineSince) {
        parts.push(`Online for ${formatDuration(now - new Date(status.onlineSince).getTime())}`);
      }
      parts.push(
        status.players.max > 0
          ? `${status.players.online} of ${status.players.max} players on`
          : plural(status.players.online, 'player') + ' on'
      );
      if (status.version && status.version !== 'Unknown') parts.push(status.version);
      return parts.join(' · ');
    }
    case 'loading':
      return 'The VM is up. Minecraft usually needs 1–2 minutes to load the world.';
    case 'booting':
      return 'Oracle Cloud is booting the VM. The world loads right after.';
    case 'stopping':
      return 'Shutting down. Everyone on the server has been disconnected.';
    case 'off':
      return 'The server is off. Starting it takes about 2 minutes.';
    default:
      return "Couldn't read the VM state from Oracle Cloud. Check the OCI credentials.";
  }
}
