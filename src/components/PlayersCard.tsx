import React from 'react';
import { User, Info, Terminal, Radio } from 'lucide-react';
import { PlayerInfo } from '../types';

interface PlayersCardProps {
  players: PlayerInfo;
  version: string;
  motd: string;
  isOnline: boolean;
}

export const PlayersCard: React.FC<PlayersCardProps> = ({
  players,
  version,
  motd,
  isOnline,
}) => {
  const percentCapacity =
    players.max > 0 ? Math.min(100, Math.round((players.online / players.max) * 100)) : 0;

  const getCapacityWidthClass = (pct: number) => {
    if (pct <= 0) return 'w-0';
    if (pct < 10) return 'w-[8%]';
    if (pct < 25) return 'w-1/4';
    if (pct < 50) return 'w-1/2';
    if (pct < 75) return 'w-3/4';
    return 'w-full';
  };

  return (
    <div className="carbon-panel rounded-2xl p-6 border border-white/[0.08] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Active Roster</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Connected players &amp; runtime parameters</p>
        </div>

        <div className="text-right font-mono">
          <div className="text-xl font-bold text-white tabular-nums">
            {isOnline ? `${players.online} / ${players.max}` : '0 / 0'}
          </div>
          <div className="text-[11px] text-neutral-400">SLOTS FILLED</div>
        </div>
      </div>

      {/* Segmented Capacity Bar */}
      {isOnline && players.max > 0 && (
        <div className="space-y-1.5">
          <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
            <div
              className={`bg-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] ${getCapacityWidthClass(
                percentCapacity
              )}`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
            <span>0%</span>
            <span>CAPACITY: {percentCapacity}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Players Radar Roster */}
      <div>
        {isOnline && players.names.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {players.names.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.06]"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 font-mono text-xs text-neutral-200 truncate font-medium">
                  {name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-black/30 border border-white/[0.04] text-center space-y-1">
            <Radio className="w-5 h-5 text-neutral-600 mx-auto" />
            <div className="text-xs font-mono text-neutral-400">
              {isOnline ? 'NO PLAYERS CURRENTLY CONNECTED' : 'SERVER OFFLINE'}
            </div>
            <div className="text-[11px] text-neutral-400">
              {isOnline ? 'Standing by for incoming connection on 25565' : 'Boot server to enable player entry'}
            </div>
          </div>
        )}
      </div>

      {/* Engine Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center gap-3">
          <Info className="w-4 h-4 text-neutral-400 shrink-0" />
          <div className="min-w-0 font-mono">
            <div className="text-[10px] text-neutral-400">ENGINE VERSION</div>
            <div className="text-xs font-semibold text-neutral-200 truncate">
              {version || 'Unknown'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-start gap-3">
          <Terminal className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
          <div className="min-w-0 font-mono">
            <div className="text-[10px] text-neutral-400">SERVER MOTD</div>
            <div className="text-xs text-neutral-300 line-clamp-1">
              {motd || 'No message configured'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
