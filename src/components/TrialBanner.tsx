import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface TrialBannerProps {
  daysLeft: number;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft }) => {
  if (daysLeft === undefined || daysLeft === null) return null;

  const isUrgent = daysLeft < 5;

  return (
    <div
      className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs font-mono transition-colors ${
        isUrgent
          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]'
          : 'bg-black/40 border-white/[0.06] text-neutral-300'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {isUrgent ? (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
        ) : (
          <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
        )}
        <span>
          {daysLeft <= 0 ? (
            <span className="text-rose-300 font-bold">ORACLE TRIAL EXPIRED // BACK UP WORLD IMMEDIATELY</span>
          ) : (
            <span>
              ORACLE FREE TRIAL ENDS IN <strong className="text-white underline">{daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'}</strong> &mdash; BACK UP WORLD
            </span>
          )}
        </span>
      </div>
      <div className="shrink-0 px-2 py-0.5 rounded bg-white/[0.06] text-neutral-400 text-[10px] font-semibold border border-white/[0.06]">
        ALWAYS FREE TIER
      </div>
    </div>
  );
};
