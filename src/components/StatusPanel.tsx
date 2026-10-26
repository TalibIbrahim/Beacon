import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getPhase, Phase, PHASE_WORD, stationIndex, STATIONS } from '../serverState';
import { StatusResponse } from '../types';

interface StatusPanelProps {
  status: StatusResponse;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const DOT_CLASS: Record<Phase, string> = {
  online: 'bg-positive',
  booting: 'bg-warning',
  loading: 'bg-warning',
  stopping: 'bg-warning',
  off: 'bg-faint',
  unknown: 'bg-negative',
};

export const StatusPanel: React.FC<StatusPanelProps> = ({ status, onToast }) => {
  const [copied, setCopied] = useState(false);
  const phase = getPhase(status);
  const current = stationIndex(phase);
  const isOnline = phase === 'online';
  const motd = status.motd && status.motd !== 'Unknown' ? status.motd.replace(/\s*\n\s*/g, ' ') : null;

  const handleCopy = async () => {
    if (!status.address) return;
    try {
      await navigator.clipboard.writeText(status.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('error', 'Could not copy. Select the address and copy it by hand.');
    }
  };

  return (
    <section className="panel" aria-labelledby="status-heading">
      <div className="p-5 sm:p-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="status-heading" className="sr-only">
            Server status
          </h2>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASS[phase]}`} aria-hidden="true" />
            <span className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">{PHASE_WORD[phase]}</span>
          </div>
          {motd && isOnline && <p className="mt-1 text-muted truncate">{motd}</p>}
        </div>

        <div className="min-w-0 sm:text-right">
          <div className="label">Join address</div>
          <div className="mt-1 flex items-center justify-between gap-3 sm:justify-end">
            <span
              className={`font-mono text-lg sm:text-xl leading-7 break-all select-all ${isOnline ? 'text-ink' : 'text-faint'}`}
            >
              {status.address || '—'}
            </span>
            {status.address && (
              <button
                type="button"
                onClick={handleCopy}
                className={`shrink-0 h-8 px-3.5 ${isOnline ? 'btn-primary' : 'btn-secondary'}`}
                aria-label={copied ? 'Address copied' : 'Copy join address'}
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          {!isOnline && status.address && (
            <div className="mt-1 text-xs text-faint">Joinable once the server is online</div>
          )}
        </div>
      </div>

      {/* Boot track: where a start is on its way from Off to Online */}
      <ol className="grid grid-cols-4 border-t border-line" aria-label="Start-up progress">
        {STATIONS.map((station, i) => {
          const isCurrent = i === current;
          const isDone = current >= 0 && i < current && phase !== 'stopping';
          const label = isCurrent && phase === 'stopping' ? 'Shutting down' : station.label;
          return (
            <li
              key={station.phase}
              className="relative px-3 sm:px-6 pt-4 pb-4 sm:pb-5 min-w-0"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* the rail */}
              <div
                className={`absolute -top-px left-0 right-0 h-px ${isCurrent ? DOT_CLASS[phase] : isDone ? 'bg-control' : 'bg-transparent'}`}
                aria-hidden="true"
              />
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isCurrent ? DOT_CLASS[phase] : isDone ? 'bg-muted' : 'border border-control'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`text-sm truncate ${isCurrent ? 'text-ink font-medium' : isDone ? 'text-muted' : 'text-faint'}`}
                >
                  <span className="sm:hidden">{isCurrent && phase === 'stopping' ? 'Stopping' : station.short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </div>
              <div className="mt-0.5 pl-4 text-xs text-faint truncate hidden sm:block">{station.detail}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
