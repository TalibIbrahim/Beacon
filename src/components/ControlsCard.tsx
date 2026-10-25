import React from 'react';
import { Play, Square, RotateCw, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { VmState } from '../types';

interface ControlsCardProps {
  vmState: VmState;
  cooldownSeconds: number;
  loadingAction: 'start' | 'stop' | 'restart' | null;
  onActionClick: (action: 'start' | 'stop' | 'restart') => void;
}

export const ControlsCard: React.FC<ControlsCardProps> = ({
  vmState,
  cooldownSeconds,
  loadingAction,
  onActionClick,
}) => {
  const isCooldown = cooldownSeconds > 0;
  const isBusy = loadingAction !== null;

  const canStart = vmState === 'STOPPED' && !isCooldown && !isBusy;
  const startReason =
    isCooldown
      ? `Cooldown active (${cooldownSeconds}s)`
      : isBusy
      ? 'Command executing'
      : vmState === 'RUNNING'
      ? 'Instance active'
      : vmState === 'STARTING'
      ? 'Provisioning...'
      : vmState === 'STOPPING'
      ? 'Stopping...'
      : null;

  const canStop = vmState === 'RUNNING' && !isCooldown && !isBusy;
  const stopReason =
    isCooldown
      ? `Cooldown active (${cooldownSeconds}s)`
      : isBusy
      ? 'Command executing'
      : vmState === 'STOPPED'
      ? 'Already stopped'
      : vmState === 'STARTING'
      ? 'Booting up'
      : vmState === 'STOPPING'
      ? 'Stopping...'
      : null;

  const canRestart = vmState === 'RUNNING' && !isCooldown && !isBusy;
  const restartReason =
    isCooldown
      ? `Cooldown active (${cooldownSeconds}s)`
      : isBusy
      ? 'Command executing'
      : vmState === 'STOPPED'
      ? 'Offline'
      : vmState === 'STARTING'
      ? 'Booting up'
      : vmState === 'STOPPING'
      ? 'Stopping...'
      : null;

  return (
    <div className="carbon-panel rounded-2xl p-6 border border-white/[0.08] space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Power Switchboard</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Physical lifecycle actions executed via authenticated OCI Cavage signatures.
          </p>
        </div>

        {isCooldown && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>COOLDOWN: {cooldownSeconds}S</span>
          </div>
        )}
      </div>

      {/* Button Switchboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* START */}
        <div className="flex flex-col">
          <button
            onClick={() => onActionClick('start')}
            disabled={!canStart}
            className={`w-full py-4 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2.5 border active:scale-[0.98] ${
              canStart
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-[0_0_24px_-4px_rgba(16,185,129,0.3)]'
                : 'bg-black/40 text-neutral-600 border-white/[0.04] cursor-not-allowed opacity-50'
            }`}
          >
            {loadingAction === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>BOOT INSTANCE</span>
          </button>
          {!canStart && startReason && (
            <span className="text-[11px] font-mono text-neutral-500 mt-2 text-center truncate">
              {startReason}
            </span>
          )}
        </div>

        {/* STOP */}
        <div className="flex flex-col">
          <button
            onClick={() => onActionClick('stop')}
            disabled={!canStop}
            className={`w-full py-4 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2.5 border active:scale-[0.98] ${
              canStop
                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
                : 'bg-black/40 text-neutral-600 border-white/[0.04] cursor-not-allowed opacity-50'
            }`}
          >
            {loadingAction === 'stop' ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
            ) : (
              <Square className="w-4 h-4 fill-current" />
            )}
            <span>GRACEFUL SHUTDOWN</span>
          </button>
          {!canStop && stopReason && (
            <span className="text-[11px] font-mono text-neutral-500 mt-2 text-center truncate">
              {stopReason}
            </span>
          )}
        </div>

        {/* RESTART */}
        <div className="flex flex-col">
          <button
            onClick={() => onActionClick('restart')}
            disabled={!canRestart}
            className={`w-full py-4 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2.5 border active:scale-[0.98] ${
              canRestart
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                : 'bg-black/40 text-neutral-600 border-white/[0.04] cursor-not-allowed opacity-50'
            }`}
          >
            {loadingAction === 'restart' ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            <span>REBOOT INSTANCE</span>
          </button>
          {!canRestart && restartReason && (
            <span className="text-[11px] font-mono text-neutral-500 mt-2 text-center truncate">
              {restartReason}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 pt-1">
        <ShieldAlert className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span>30s rate cooldown enforced by KV counter to protect cloud compute quota.</span>
      </div>
    </div>
  );
};
