import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getPhase, Phase, PHASE_LINE, PHASE_WORD, stationIndex, STATIONS } from '../serverState';
import { StatusResponse } from '../types';
import { BlockKind, PixelBeacon, PixelBlock, PixelBurst } from './Pixel';

interface StatusPanelProps {
  status: StatusResponse;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const DOT_CLASS: Record<Phase, string> = {
  online: 'bg-positive text-positive anim-dot',
  booting: 'bg-warning',
  loading: 'bg-warning',
  stopping: 'bg-warning',
  off: 'bg-stone',
  unknown: 'bg-negative',
};

// The four stations of a start, as blocks: stone, dirt, grass, then the beacon itself
const BLOCK: BlockKind[] = ['stone', 'dirt', 'grass', 'beacon'];

// The card's top band follows the state, so grass (online) never sits over "Off"
const BAND: Record<Phase, string> = {
  off: 'band-stone',
  stopping: 'band-stone',
  unknown: 'band-stone',
  booting: 'band-torch',
  loading: 'band-torch',
  online: 'band-grass',
};

// How the current block moves: dozing while off, bobbing while it boots
const CURRENT_ANIM: Record<Phase, string> = {
  off: 'anim-sleepy',
  stopping: 'anim-sleepy',
  booting: 'anim-bob',
  loading: 'anim-bob',
  online: '',
  unknown: '',
};

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status, onToast }) => {
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(false);
  const phase = getPhase(status);
  const current = stationIndex(phase);
  const isOnline = phase === 'online';
  const motd = status.motd && status.motd !== 'Unknown' ? status.motd.replace(/\s*\n\s*/g, ' ') : null;

  // One small burst when the server comes online while you watch (not when you open the page)
  const prevPhase = useRef<Phase | null>(null);
  useEffect(() => {
    if (prevPhase.current && prevPhase.current !== 'online' && phase === 'online' && !prefersReducedMotion()) {
      setBurst(true);
    }
    prevPhase.current = phase;
  }, [phase]);
  const endBurst = useCallback(() => setBurst(false), []);

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
    <section className={`panel ${BAND[phase]}`} aria-labelledby="status-heading">
      <div className="pt-7 pb-5 px-5 sm:px-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative">
            <PixelBeacon phase={phase} size={72} />
            {burst && <PixelBurst onDone={endBurst} />}
          </div>
          <div className="min-w-0">
            <h2 id="status-heading" className="sr-only">
              Server status
            </h2>
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-[3px] shrink-0 ${DOT_CLASS[phase]}`} aria-hidden="true" />
              <span className="font-display font-semibold text-[34px] leading-10 tracking-[0.01em]">{PHASE_WORD[phase]}</span>
            </div>
            <p className="mt-0.5 text-muted truncate">
              {PHASE_LINE[phase]}
              {motd && isOnline && <span className="text-faint"> · {motd}</span>}
            </p>
          </div>
        </div>

        <div className="min-w-0 sm:shrink-0 sm:text-right">
          <div className="label">Join address</div>
          {/* The address never breaks mid-number: on a narrow screen the button wraps instead */}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:justify-end">
            <span
              className={`num font-semibold text-lg sm:text-xl leading-7 tracking-[0.01em] whitespace-nowrap select-all ${isOnline ? 'text-ink' : 'text-faint'}`}
            >
              {status.address || '—'}
            </span>
            {status.address && (
              <button
                type="button"
                onClick={handleCopy}
                className={`shrink-0 ${isOnline ? 'btn-primary' : 'btn-secondary'}`}
                aria-label={copied ? 'Address copied' : 'Copy join address'}
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          {!isOnline && status.address && (
            <div className="mt-1.5 text-xs text-faint">Joinable once the server is online</div>
          )}
        </div>
      </div>

      {/* Boot track: four blocks that fill in as a start makes its way from Off to Online */}
      <ol className="grid grid-cols-4 gap-2 sm:gap-4 px-4 sm:px-6 pt-5 pb-5 border-t-2 border-rule" aria-label="Start-up progress">
        {STATIONS.map((station, i) => {
          const isCurrent = i === current;
          const reached = current >= 0 && i <= current;
          const label = isCurrent && phase === 'stopping' ? 'Shutting down' : station.label;
          const shortLabel = isCurrent && phase === 'stopping' ? 'Stopping' : station.short;
          return (
            <li key={station.phase} className="relative min-w-0 flex flex-col gap-2.5" aria-current={isCurrent ? 'step' : undefined}>
              {/* The rail to the next block: lit once the boot has passed it */}
              {i < STATIONS.length - 1 && (
                <span
                  className={`absolute top-[14px] sm:top-[19px] left-[38px] sm:left-[50px] -right-[2px] sm:-right-[10px] h-0 border-t-[3px] ${
                    current > i ? 'border-solid border-beam' : 'border-dotted border-control'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`inline-flex w-fit rounded-[3px] ${isCurrent ? 'outline outline-2 outline-offset-2 outline-accent' : ''}`}
              >
                <PixelBlock kind={BLOCK[i]} filled={reached} className={isCurrent ? CURRENT_ANIM[phase] : ''} />
              </span>
              <div className="min-w-0">
                <div className={`text-sm truncate ${isCurrent ? 'text-ink font-semibold' : reached ? 'text-muted' : 'text-faint'}`}>
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                  {isCurrent && <span className="sr-only"> (current step)</span>}
                </div>
                <div className="text-xs text-faint truncate hidden sm:block">{station.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
