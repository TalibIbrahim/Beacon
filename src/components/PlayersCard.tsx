import React from 'react';
import { Users } from 'lucide-react';
import { Phase } from '../serverState';
import { PlayerInfo } from '../types';
import { PixelAvatar } from './Pixel';

interface PlayersCardProps {
  players: PlayerInfo;
  phase: Phase;
}

const EMPTY_COPY: Record<Phase, string> = {
  online: 'Nobody’s on yet. Be the first.',
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
    <section className="panel band-sky" aria-labelledby="players-heading">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-6 pb-3">
        <h2 id="players-heading" className="card-title">
          Players
        </h2>
        <span className="num text-muted">
          {isOnline ? (
            <>
              <span className="text-ink text-xl font-semibold">{players.online}</span>
              {players.max > 0 && <span> / {players.max}</span>}
              <span className="sr-only"> online</span>
            </>
          ) : (
            '—'
          )}
        </span>
      </header>

      {names.length > 0 || unnamed > 0 ? (
        <ul className="px-5 pb-4">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-3 min-h-[44px] border-t-2 border-rule first:border-t-0">
              <PixelAvatar name={name} size={30} />
              <span className="truncate font-medium">{name}</span>
            </li>
          ))}
          {unnamed > 0 && (
            <li className="flex items-center gap-3 min-h-[44px] border-t-2 border-rule first:border-t-0 text-muted">
              <span className="icon-tile bg-raised text-muted">
                <Users className="w-4 h-4" aria-hidden="true" />
              </span>
              {names.length > 0 ? `+${unnamed} more` : `${unnamed} online (names hidden by the server)`}
            </li>
          )}
        </ul>
      ) : (
        <p className="mx-5 mb-5 px-3.5 py-3 rounded-lg border-2 border-dashed border-line text-muted">{EMPTY_COPY[phase]}</p>
      )}
    </section>
  );
};
