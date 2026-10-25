import React, { useState } from 'react';
import {
  Copy,
  Check,
  HelpCircle,
  Terminal,
} from 'lucide-react';
import { MinecraftState, VmState } from '../types';

interface ServerStatusCardProps {
  vmState: VmState;
  minecraftState: MinecraftState;
  address: string;
  onlineSince: string | null;
}

export const ServerStatusCard: React.FC<ServerStatusCardProps> = ({
  vmState,
  minecraftState,
  address,
  onlineSince,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Format uptime string
  const formatUptime = (isoString: string | null): string => {
    if (!isoString) return 'Offline';
    try {
      const start = new Date(isoString).getTime();
      const now = Date.now();
      const diffMs = Math.max(0, now - start);

      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
      }
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      }
      if (minutes > 0) {
        return `${minutes}m`;
      }
      return '< 1m';
    } catch {
      return 'Unknown';
    }
  };

  const isVmRunning = vmState === 'RUNNING';
  const isMcOnline = minecraftState === 'Online';

  return (
    <div className="carbon-panel rounded-2xl overflow-hidden border border-white/[0.08]">
      {/* Top telemetry strip */}
      <div className="milled-strip px-5 py-3 flex items-center justify-between text-xs font-mono text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="text-neutral-500 font-semibold">INSTANCE</span>
          <span className="text-neutral-200">VM.Standard.E5.Flex</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-400">2 OCPU · 12 GB RAM</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">REGION</span>
          <span className="text-neutral-300">me-dubai-1</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Dual Primary State Readouts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cloud VM State Indicator */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-400 font-mono">ORACLE CLOUD VM</div>
              <div className="text-base font-bold text-white tracking-tight mt-0.5">
                Compute Instance
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
                isVmRunning
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : vmState === 'STARTING' || vmState === 'STOPPING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-neutral-800/40 border-white/10 text-neutral-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isVmRunning
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    : vmState === 'STARTING' || vmState === 'STOPPING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-neutral-500'
                }`}
              />
              <span>{vmState}</span>
            </div>
          </div>

          {/* Minecraft Server Engine State */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-400 font-mono">MINECRAFT ENGINE</div>
              <div className="text-base font-bold text-white tracking-tight mt-0.5">
                Game Server Daemon
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
                isMcOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : minecraftState === 'Starting up'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-neutral-800/40 border-white/10 text-neutral-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isMcOnline
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    : minecraftState === 'Starting up'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-neutral-500'
                }`}
              />
              <span>{minecraftState}</span>
            </div>
          </div>
        </div>

        {/* Server Public Address & Uptime Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Address Block */}
          <div className="md:col-span-2 p-4 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-neutral-400">PUBLIC ENDPOINT</span>
              <span className="text-[11px] font-mono text-neutral-500">DEFAULT PORT 25565</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-base sm:text-lg font-bold text-white tracking-tight select-all">
                {address || <span className="text-neutral-500 font-normal italic">Instance powered off</span>}
              </div>

              {address && (
                <button
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 transition-all border border-white/[0.08] active:scale-95"
                  title="Copy address"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {address && (
              <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                <Terminal className="w-3 h-3 text-neutral-600" />
                <span>Quick connect: <code className="text-neutral-400 select-all">{address}</code></span>
              </div>
            )}
          </div>

          {/* Uptime Block */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col justify-between relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-neutral-400">ONLINE FOR</span>
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                  aria-label="Uptime measurement details"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>

                {showTooltip && (
                  <div className="absolute right-0 bottom-full mb-2 w-52 p-2.5 rounded-lg bg-neutral-900 border border-white/10 text-[11px] text-neutral-300 shadow-glass z-20 pointer-events-none font-sans">
                    Measured from when the dashboard first noticed Minecraft online.
                  </div>
                )}
              </div>
            </div>

            <div className="font-mono text-lg font-bold text-white tabular-nums">
              {isMcOnline ? formatUptime(onlineSince) : <span className="text-neutral-500 font-normal">Offline</span>}
            </div>

            <div className="text-[11px] font-mono text-neutral-500 mt-2">
              {isMcOnline ? 'Active polling active' : 'Awaiting start'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
