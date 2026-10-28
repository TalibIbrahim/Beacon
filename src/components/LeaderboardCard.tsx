import React from 'react';
import { formatRelative } from '../format';
import { LeaderboardEntry } from '../types';
import { PixelAvatar } from './Pixel';

interface LeaderboardCardProps {
  entries?: LeaderboardEntry[];
}

// "<1m", "47m", "12h 30m", "3d 4h"
function formatPlaytime(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return '<1m';
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ entries }) => {
  // Hidden until the database is connected (the status response leaves it out)
  if (!entries) return null;

  return (
    <section className="panel band-sky" aria-labelledby="leaderboard-heading">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-6 pb-3">
        <h2 id="leaderboard-heading" className="card-title">
          Leaderboard
        </h2>
        <span className="text-xs text-faint">by playtime</span>
      </header>

      {entries.length === 0 ? (
        <p className="mx-5 mb-5 px-3.5 py-3 rounded-lg border-2 border-dashed border-line text-muted">
          No playtime yet. It is counted from the online list arm-free reports every minute.
        </p>
      ) : (
        <ol className="px-5 pb-4">
          {entries.map((entry, i) => (
            <li key={`${entry.name}-${i}`} className="flex items-center gap-3 min-h-[52px] py-2 border-t-2 border-rule first:border-t-0">
              <span className="w-5 shrink-0 text-right num text-sm text-faint" aria-label={`Rank ${i + 1}`}>
                {i + 1}
              </span>
              <PixelAvatar name={entry.name} size={30} />
              <div className="min-w-0 flex-1">
                {/* Names come from an offline-mode server: always rendered as plain text */}
                <div className="truncate font-medium">{entry.name}</div>
                {entry.online ? (
                  <span className="mt-0.5 pill h-5 px-1.5 bg-pill-positive text-positive">
                    <span className="w-1.5 h-1.5 rounded-[2px] bg-positive" aria-hidden="true" />
                    Online now
                  </span>
                ) : (
                  <div className="text-xs text-faint truncate">
                    Last seen <time dateTime={entry.lastSeen}>{formatRelative(entry.lastSeen)}</time>
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="num font-semibold">{formatPlaytime(entry.totalMs)}</div>
                <div className="num text-xs text-faint">
                  {entry.sessions} {entry.sessions === 1 ? 'session' : 'sessions'}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="px-5 py-3 border-t-2 border-rule text-xs text-faint">
        Names are not verified (offline mode), so the same name always counts as the same player.
      </p>
    </section>
  );
};
