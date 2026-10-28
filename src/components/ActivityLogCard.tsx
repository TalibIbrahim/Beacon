import React, { useState } from 'react';
import {
  DatabaseBackup,
  Download,
  LogIn,
  LucideIcon,
  Play,
  RotateCw,
  ShieldAlert,
  Square,
  TimerOff,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { formatDate, formatRelative } from '../format';
import { ActivityLogEntry } from '../types';

interface ActivityLogCardProps {
  logs: ActivityLogEntry[];
}

const VISIBLE_ROWS = 6;

function describe(entry: ActivityLogEntry): string {
  const auto = entry.actor === 'cron';
  switch (entry.action) {
    case 'START':
      return 'Started the server';
    case 'STOP':
      return auto ? 'Auto-stopped the server' : 'Stopped the server';
    case 'RESTART':
      return 'Restarted the server';
    case 'LOGIN':
      return 'Signed in';
    case 'FAILED_LOGIN':
      return 'Wrong password';
    case 'BACKUP_DOWNLOAD':
      return 'Downloaded the world save';
    case 'BACKUP_REQUEST':
      return 'Asked for a backup';
    case 'BACKUP_RUN':
      return 'Backup from arm-free';
    case 'RESTORE_REQUEST':
      return 'Asked for a restore';
    case 'RESTORE_RUN':
      return 'Restore from a snapshot';
    default:
      return entry.action;
  }
}

// An icon and a tint per kind of event, so the list scans like a quest log rather than a log file
function iconFor(entry: ActivityLogEntry): { Icon: LucideIcon; tint: string } {
  switch (entry.action) {
    case 'START':
      return { Icon: Play, tint: 'bg-pill-positive text-positive' };
    case 'STOP':
      return entry.actor === 'cron'
        ? { Icon: TimerOff, tint: 'bg-raised text-muted' }
        : { Icon: Square, tint: 'bg-pill-warning text-warning' };
    case 'RESTART':
      return { Icon: RotateCw, tint: 'bg-pill-warning text-warning' };
    case 'LOGIN':
      return { Icon: LogIn, tint: 'bg-pill-info text-info' };
    case 'FAILED_LOGIN':
      return { Icon: ShieldAlert, tint: 'bg-pill-negative text-negative' };
    case 'BACKUP_DOWNLOAD':
      return { Icon: Download, tint: 'bg-pill-info text-info' };
    case 'BACKUP_REQUEST':
      return { Icon: DatabaseBackup, tint: 'bg-raised text-muted' };
    case 'BACKUP_RUN':
      return { Icon: Archive, tint: 'bg-pill-positive text-positive' };
    case 'RESTORE_REQUEST':
      return { Icon: ArchiveRestore, tint: 'bg-pill-warning text-warning' };
    case 'RESTORE_RUN':
      return { Icon: ArchiveRestore, tint: 'bg-pill-positive text-positive' };
    default:
      return { Icon: Square, tint: 'bg-raised text-muted' };
  }
}

export const ActivityLogCard: React.FC<ActivityLogCardProps> = ({ logs }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? logs : logs.slice(0, VISIBLE_ROWS);

  return (
    <section className="panel band-stone" aria-labelledby="activity-heading">
      <header className="flex items-center justify-between gap-3 px-5 pt-6 pb-2">
        <h2 id="activity-heading" className="card-title">
          Recent activity
        </h2>
        {logs.length > VISIBLE_ROWS && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="btn-ghost -mr-2.5" aria-expanded={showAll}>
            {showAll ? 'Show less' : `Show all ${logs.length}`}
          </button>
        )}
      </header>

      {logs.length === 0 ? (
        <p className="mx-5 mb-5 px-3.5 py-3 rounded-lg border-2 border-dashed border-line text-muted">
          Nothing has happened yet. Starts, stops, sign-ins, backups and downloads show up here.
        </p>
      ) : (
        <ul className="px-5 pb-3">
          {visible.map((entry) => {
            const failed = entry.result === 'FAILED';
            const isLoginFailure = entry.action === 'FAILED_LOGIN';
            const who = entry.actor === 'cron' ? 'Auto-stop' : entry.actor === 'agent' ? 'arm-free' : entry.actor;
            const named = entry.actor === 'cron' || entry.actor === 'agent';
            // The worker writes "Auto-stopped after 30m idle…"; the row title already says it
            const details = entry.details?.replace(/^Auto-stopped\s+/i, '');
            const { Icon, tint } = failed && !isLoginFailure ? { Icon: ShieldAlert, tint: 'bg-pill-negative text-negative' } : iconFor(entry);
            return (
              <li key={entry.id} className="flex items-start gap-3 py-3 border-t-2 border-rule first:border-t-0">
                <span className={`icon-tile ${tint}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium">{describe(entry)}</span>
                    {failed && !isLoginFailure && (
                      <span className="flex-none h-5 px-1.5 inline-flex items-center rounded border border-edge bg-pill-negative text-negative text-xs font-semibold">
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-faint truncate">
                    <span className={named ? '' : 'font-mono'}>{who}</span>
                    {details && <span> · {details}</span>}
                  </div>
                </div>
                <time
                  dateTime={entry.timestamp}
                  title={formatDate(entry.timestamp)}
                  className={`shrink-0 pt-0.5 num text-sm ${isLoginFailure ? 'text-negative' : 'text-muted'}`}
                >
                  {formatRelative(entry.timestamp)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-5 py-3 border-t-2 border-rule text-xs text-faint">Visitors show as a short hash of their IP address.</p>
    </section>
  );
};
