import React, { useCallback, useState } from 'react';
import { ArchiveRestore, Loader2 } from 'lucide-react';
import { ApiError, requestRestore } from '../api';
import { formatBytes, formatDate, formatRelative } from '../format';
import { BackupJobInfo } from '../types';
import { RestoreConfirmModal } from './RestoreConfirmModal';

interface RestorePointsProps {
  job: BackupJobInfo;
  onRequested: () => unknown;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const VISIBLE = 7;
const RESULT_VISIBLE_MS = 24 * 60 * 60 * 1000;

// Daily snapshots on arm-free, each restorable after a typed confirmation. Beacon re-checks every
// condition on the server; the reason shown here is the same one the server would give.
export const RestorePoints: React.FC<RestorePointsProps> = ({ job, onRequested, onToast }) => {
  const [selected, setSelected] = useState<BackupJobInfo['snapshots'][number] | null>(null);
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const close = useCallback(() => setSelected(null), []);

  if (!job.configured) return null;

  const { restore, restoreBlocked, snapshots } = job;
  const active = restore?.state === 'pending' || restore?.state === 'running';
  const recent = (iso?: string) => Boolean(iso && Date.now() - new Date(iso).getTime() < RESULT_VISIBLE_MS);
  const visible = showAll ? snapshots : snapshots.slice(0, VISIBLE);

  const confirm = async (name: string) => {
    setSending(true);
    try {
      await requestRestore(name);
      onToast('info', 'Restore requested. arm-free starts within a minute and stops Minecraft first.');
      setSelected(null);
      onRequested();
    } catch (err) {
      onToast('error', err instanceof ApiError || err instanceof Error ? err.message : 'Could not request the restore.');
    } finally {
      setSending(false);
    }
  };

  let status: { tone: string; text: string; spin?: boolean } | null = null;
  if (restore?.state === 'pending') {
    status = { tone: 'text-warning', spin: true, text: `Restore of ${restore.snapshot} requested. arm-free picks it up within a minute.` };
  } else if (restore?.state === 'running') {
    status = {
      tone: 'text-warning',
      spin: true,
      text: `Restoring ${restore.snapshot} since ${formatRelative(restore.startedAt)}. Minecraft is stopped; power buttons are blocked until it finishes.`,
    };
  } else if (restore?.state === 'done' && recent(restore.finishedAt)) {
    status = {
      tone: 'text-positive',
      text: `Restored ${restore.snapshot} ${formatRelative(restore.finishedAt)}. Minecraft stays stopped until someone uses Restart.`,
    };
  } else if (restore?.state === 'failed' && recent(restore.finishedAt ?? restore.requestedAt)) {
    status = { tone: 'text-negative', text: `Restore failed: ${restore.error ?? 'no reason given'}` };
  }

  return (
    <div className="border-t-2 border-rule">
      <div className="px-5 pt-4 pb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">Restore points</h3>
        <span className="text-xs text-faint">daily snapshots on arm-free</span>
      </div>

      <div aria-live="polite">
        {status && (
          <p className={`mx-5 mb-3 flex items-start gap-2 ${status.tone}`}>
            {status.spin && <Loader2 className="w-3.5 h-3.5 mt-[3px] shrink-0 animate-spin" aria-hidden="true" />}
            <span className="min-w-0 break-words">{status.text}</span>
          </p>
        )}
      </div>

      {snapshots.length === 0 ? (
        <p className="mx-5 mb-4 px-3.5 py-3 rounded-lg border-2 border-dashed border-line text-muted">
          No daily snapshots reported yet. They appear here once mc-agent.sh lists ~/mc-backup/daily.
        </p>
      ) : (
        <>
          {restoreBlocked && !active && <p className="mx-5 mb-2 text-xs text-faint">Restore is unavailable: {restoreBlocked}</p>}
          <ul className="px-5 pb-3">
            {visible.map((snap) => (
              <li key={snap.name} className="flex items-center justify-between gap-3 min-h-[52px] py-1.5 border-t-2 border-rule first:border-t-0">
                <div className="min-w-0">
                  <div className="num">{formatDate(snap.mtime)}</div>
                  <div className="text-xs text-faint truncate">
                    <span className="font-mono">{snap.name}</span> · <span className="num">{formatBytes(snap.sizeBytes)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={Boolean(restoreBlocked) || sending}
                  onClick={() => setSelected(snap)}
                  aria-label={`Restore ${snap.name}`}
                  title={restoreBlocked ?? undefined}
                >
                  <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
          {snapshots.length > VISIBLE && (
            <div className="px-5 pb-3 -mt-1">
              <button type="button" className="btn-ghost -ml-2.5" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? 'Show fewer' : `Show all ${snapshots.length}`}
              </button>
            </div>
          )}
        </>
      )}

      <RestoreConfirmModal snapshot={selected} loading={sending} onConfirm={confirm} onClose={close} />
    </div>
  );
};
