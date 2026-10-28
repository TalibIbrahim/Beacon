import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatBytes, formatDate } from '../format';

interface RestoreConfirmModalProps {
  snapshot: { name: string; sizeBytes: number; mtime: string } | null;
  loading: boolean;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

const PHRASE = 'RESTORE';

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({ snapshot, loading, onConfirm, onClose }) => {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = typed.trim().toUpperCase() === PHRASE;

  useEffect(() => {
    if (!snapshot) return;
    setTyped('');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [snapshot, loading, onClose]);

  if (!snapshot) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || loading) return;
    onConfirm(snapshot.name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[color-mix(in_srgb,var(--obsidian)_70%,transparent)]"
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        aria-describedby="restore-body"
        className="relative w-full max-w-md panel band-stone px-6 pb-6 pt-8 animate-dialog-in"
      >
        <h2 id="restore-title" className="font-display font-semibold text-[22px] leading-7">
          Restore this snapshot?
        </h2>

        <div id="restore-body" className="mt-2 space-y-3 text-muted">
          <p>
            <span className="font-mono text-ink break-all">{snapshot.name}</span>
            <span className="num">
              {' '}
              · {formatDate(snapshot.mtime)} · {formatBytes(snapshot.sizeBytes)}
            </span>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Minecraft is stopped on Minecraft-Premium.</li>
            <li>The current world, Nether and End are set aside on the VM (the last 2 restores are kept).</li>
            <li>They are replaced with the ones from this snapshot. Plugins and settings are not touched.</li>
            <li>Minecraft stays stopped afterwards. Use Restart to bring it back.</li>
          </ul>
          <div className="p-3.5 rounded-lg border-2 border-edge bg-pill-warning">
            <p className="text-ink">Anything built since this snapshot is replaced by the snapshot&apos;s world.</p>
            <label htmlFor="restore-input" className="block mt-3 text-sm">
              Type <span className="font-semibold text-ink">{PHRASE}</span> to confirm
            </label>
            <input
              ref={inputRef}
              id="restore-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={loading}
              className="mt-1.5 w-full h-11 px-3 rounded-lg bg-surface border-2 border-control text-ink outline-none focus:border-[var(--focus)]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!confirmed || loading}
            className="btn bg-negative text-on-negative hover:brightness-110 disabled:bg-raised disabled:text-faint disabled:border-line"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Sending…' : 'Restore snapshot'}
          </button>
        </div>
      </form>
    </div>
  );
};
