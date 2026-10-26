import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { plural } from '../format';

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
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPlayers = playerCount > 0;
  const isStop = action === 'stop';
  const phrase = isStop ? 'STOP' : 'RESTART';
  const confirmed = !hasPlayers || typed.trim().toUpperCase() === phrase;

  // Fresh dialog every time it opens
  useEffect(() => {
    if (!isOpen) return;
    setTyped('');
    const t = setTimeout(() => (hasPlayers ? inputRef.current : cancelRef.current)?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen, action, hasPlayers]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || loading) return;
    onConfirm(hasPlayers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70" onClick={() => !loading && onClose()} aria-hidden="true" />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full max-w-md panel bg-surface p-6 shadow-[0_12px_28px_rgba(0,0,0,0.45)] animate-dialog-in"
      >
        <h2 id="confirm-title" className="text-xl font-semibold">
          {isStop ? 'Stop the server?' : 'Restart the server?'}
        </h2>

        <div id="confirm-body" className="mt-2 space-y-4 text-muted">
          <p>
            {isStop
              ? 'Oracle shuts the VM down gracefully. Starting it again takes about 2 minutes.'
              : 'The VM reboots and Minecraft loads the world again. Expect about 2 minutes offline.'}
          </p>

          {hasPlayers && (
            <div className="p-3 rounded-card bg-pill-negative">
              <p className="text-ink">
                {plural(playerCount, 'player')} {playerCount === 1 ? 'is' : 'are'} on right now and will be
                disconnected.
              </p>
              <label htmlFor="confirm-input" className="block mt-3 text-sm">
                Type <span className="font-semibold text-ink">{phrase}</span> to confirm
              </label>
              <input
                ref={inputRef}
                id="confirm-input"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={loading}
                className="mt-1.5 w-full h-10 px-3 rounded-card bg-ground border border-control text-ink outline-none focus:border-negative"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={loading} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!confirmed || loading}
            className="btn bg-negative text-white hover:brightness-110 disabled:bg-raised disabled:text-faint"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Sending…' : isStop ? 'Stop server' : 'Restart server'}
          </button>
        </div>
      </form>
    </div>
  );
};
