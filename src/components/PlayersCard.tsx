import React from 'react';
import { Phase } from '../serverState';
import { PlayerInfo } from '../types';

interface PlayersCardProps {
  players: PlayerInfo;
  phase: Phase;
}

// A stable hue per name, so each friend keeps the same colour every visit
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  // 12 hues, 30 degrees apart
  return (hash % 12) * 30;
}

const EMPTY_COPY: Record<Phase, string> = {
  online: 'Nobody is on right now.',
  loading: 'Players can join once the world has loaded.',
  booting: 'Players can join once the world has loaded.',
  stopping: 'The server is shutting down.',
  off: 'Nobody can join while the server is off.',
  unknown: 'Player list unavailable.',
};

export const PlayersCard: React.FC<PlayersCardProps> = ({ players, phase }) => {
  const isOnline = phase === 'online';
  const names = isOnline ? players.names : [];
  // mcsrvstat only lists names for some servers; the count is always right
  const unnamed = isOnline ? Math.max(0, players.online - names.length) : 0;

  return (
    <section className="panel" aria-labelledby="players-heading">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 id="players-heading" className="text-base font-semibold">
          Players
        </h2>
        <span className="num text-muted">
          {isOnline ? (
            <>
              <span className="text-ink text-xl font-medium">{players.online}</span>
              {players.max > 0 && <span> / {players.max}</span>}
            </>
          ) : (
            '—'
          )}
        </span>
      </header>

      {names.length > 0 || unnamed > 0 ? (
        <ul className="px-5 pb-4">
          {names.map((name) => {
            const hue = nameHue(name);
            return (
              <li key={name} className="flex items-center gap-3 h-10 border-t border-rule first:border-t-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ backgroundColor: `hsl(${hue} 30% 20%)`, color: `hsl(${hue} 70% 80%)` }}
                  aria-hidden="true"
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{name}</span>
              </li>
            );
          })}
          {unnamed > 0 && (
            <li className="flex items-center h-10 border-t border-rule first:border-t-0 text-muted">
              {names.length > 0 ? `+${unnamed} more` : `${unnamed} online (names hidden by the server)`}
            </li>
          )}
        </ul>
      ) : (
        <p className="mx-5 mb-5 px-3 py-2.5 rounded-card border border-dashed border-line text-muted">
          {EMPTY_COPY[phase]}
        </p>
      )}
    </section>
  );
};
