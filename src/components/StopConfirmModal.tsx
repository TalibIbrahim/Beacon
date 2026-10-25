import React, { useState } from 'react';
import { AlertTriangle, PowerOff, X, RotateCw } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  action: 'stop' | 'restart';
  playerCount: number;
  loading: boolean;
  onConfirm: (force: boolean) => void;
  onClose: () => void;
}

export const StopConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  action,
  playerCount,
  loading,
  onConfirm,
  onClose,
}) => {
  const [typedConfirm, setTypedConfirm] = useState('');

  if (!isOpen) return null;

  const hasPlayers = playerCount > 0;
  const isActionStop = action === 'stop';
  const requiredPhrase = 'STOP';
  const isConfirmed = !hasPlayers || typedConfirm.trim().toUpperCase() === requiredPhrase;

  const handleAction = () => {
    if (!isConfirmed || loading) return;
    onConfirm(hasPlayers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md carbon-panel rounded-2xl p-6 border border-white/[0.12] z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isActionStop
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
              }`}
            >
              {isActionStop ? (
                <PowerOff className="w-5 h-5" />
              ) : (
                <RotateCw className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {isActionStop ? 'Authorize Server Shutdown' : 'Authorize Server Reboot'}
              </h2>
              <p className="text-xs font-mono text-neutral-400">
                OCI VM.Standard.E5.Flex // me-dubai-1
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning content */}
        <div className="my-5 space-y-4">
          {hasPlayers ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>ACTIVE SESSIONS DETECTED ({playerCount})</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed font-sans">
                There {playerCount === 1 ? 'is' : 'are'} currently{' '}
                <strong className="underline font-bold text-white font-mono">
                  {playerCount} {playerCount === 1 ? 'player' : 'players'}
                </strong>{' '}
                connected to the server. Initiating {isActionStop ? 'shutdown' : 'reboot'} will terminate all player connections immediately.
              </p>
              <div className="pt-1">
                <label
                  htmlFor="stop-confirm-input"
                  className="block text-xs font-mono text-neutral-300 mb-1.5"
                >
                  Type <span className="font-bold text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/10">STOP</span> to confirm override:
                </label>
                <input
                  id="stop-confirm-input"
                  type="text"
                  value={typedConfirm}
                  onChange={(e) => setTypedConfirm(e.target.value)}
                  placeholder="STOP"
                  autoFocus
                  disabled={loading}
                  className="w-full bg-black/70 border border-white/20 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 rounded-xl px-3 py-2 text-sm text-white font-mono tracking-widest outline-none"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-neutral-300">
              Are you sure you want to send the {isActionStop ? 'SOFTSTOP' : 'SOFTRESET'} signal to the instance?
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            ABORT
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={!isConfirmed || loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold text-white transition-all disabled:opacity-30 disabled:pointer-events-none ${
              isActionStop
                ? 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_20px_-3px_rgba(244,63,94,0.5)]'
                : 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_-3px_rgba(245,158,11,0.5)]'
            }`}
          >
            {loading ? 'TRANSMITTING...' : isActionStop ? 'CONFIRM SHUTDOWN' : 'CONFIRM REBOOT'}
          </button>
        </div>
      </div>
    </div>
  );
};
