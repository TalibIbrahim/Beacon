import React, { useState } from 'react';
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
    default:
      return entry.action;
  }
}

export const ActivityLogCard: React.FC<ActivityLogCardProps> = ({ logs }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? logs : logs.slice(0, VISIBLE_ROWS);

  return (
    <section className="panel" aria-labelledby="activity-heading">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 id="activity-heading" className="text-base font-semibold">
          Recent activity
        </h2>
        {logs.length > VISIBLE_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-muted hover:text-ink transition-colors"
            aria-expanded={showAll}
          >
            {showAll ? 'Show less' : `Show all ${logs.length}`}
          </button>
        )}
      </header>

      {logs.length === 0 ? (
        <p className="mx-5 mb-5 px-3 py-2.5 rounded-card border border-dashed border-line text-muted">
          Nothing has happened yet. Starts, stops, sign-ins and downloads show up here.
        </p>
      ) : (
        <ul className="px-5 pb-2">
          {visible.map((entry) => {
            const failed = entry.result === 'FAILED';
            const isLoginFailure = entry.action === 'FAILED_LOGIN';
            const who = entry.actor === 'cron' ? 'Auto-stop' : entry.actor;
            // The worker writes "Auto-stopped after 30m idle…"; the row title already says it
            const details = entry.details?.replace(/^Auto-stopped\s+/i, '');
            return (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 border-t border-rule first:border-t-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{describe(entry)}</span>
                    {failed && !isLoginFailure && (
                      <span className="flex-none h-5 px-2 inline-flex items-center rounded-full bg-pill-negative text-negative text-xs">
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-faint truncate">
                    <span className={entry.actor === 'cron' ? '' : 'font-mono'}>{who}</span>
                    {details && <span> · {details}</span>}
                  </div>
                </div>
                <time
                  dateTime={entry.timestamp}
                  title={formatDate(entry.timestamp)}
                  className={`shrink-0 num text-sm ${isLoginFailure ? 'text-negative' : 'text-muted'}`}
                >
                  {formatRelative(entry.timestamp)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-5 py-3 border-t border-line text-xs text-faint">
        Visitors show as a short hash of their IP address.
      </p>
    </section>
  );
};
