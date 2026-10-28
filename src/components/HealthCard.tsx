import React from 'react';
import { Activity, CircleAlert, CircleCheck, CircleX, Clock, Gauge, MemoryStick } from 'lucide-react';
import { formatBytes, formatDuration, formatRelative } from '../format';
import { ServerHealthInfo } from '../types';

interface HealthCardProps {
  health?: ServerHealthInfo;
}

type Band = 'good' | 'warn' | 'bad' | 'none';

// TPS bands: 19+ good, 15-19 strained, under 15 lagging. Each has a word and an icon, not only a colour.
function tpsBand(tps: number | null): Band {
  if (tps === null) return 'none';
  if (tps >= 19) return 'good';
  if (tps >= 15) return 'warn';
  return 'bad';
}

const BAND: Record<Band, { label: string; text: string; pill: string; Icon: typeof CircleCheck }> = {
  good: { label: 'Good', text: 'text-positive', pill: 'bg-pill-positive text-positive', Icon: CircleCheck },
  warn: { label: 'Strained', text: 'text-warning', pill: 'bg-pill-warning text-warning', Icon: CircleAlert },
  bad: { label: 'Lagging', text: 'text-negative', pill: 'bg-pill-negative text-negative', Icon: CircleX },
  none: { label: 'Unavailable', text: 'text-faint', pill: 'bg-raised text-muted', Icon: Activity },
};

const Unavailable = () => <span className="text-faint">unavailable</span>;

export const HealthCard: React.FC<HealthCardProps> = ({ health }) => {
  // Hidden until arm-free has reported at least once
  if (!health) return null;

  const off = health.minecraftOnline === false;
  const dimmed = off || health.stale;
  const band = dimmed ? 'none' : tpsBand(health.tps);
  const { label, text, pill, Icon } = BAND[band];
  const pillText = off ? 'Not running' : health.stale ? 'No recent data' : label;

  const memRatio = health.rssBytes !== null && health.memTotalBytes ? Math.min(1, health.rssBytes / health.memTotalBytes) : null;
  const segments = 12;
  const lit = memRatio === null ? 0 : Math.round(memRatio * segments);

  return (
    <section className="panel band-stone" aria-labelledby="health-heading">
      <header className="flex items-center justify-between gap-3 px-5 pt-6 pb-3">
        <h2 id="health-heading" className="card-title">
          Server health
        </h2>
        <span className={`pill ${off || health.stale ? 'bg-raised text-muted' : pill}`}>
          {!dimmed && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
          {pillText}
        </span>
      </header>

      {off ? (
        <p className="mx-5 mb-5 px-3.5 py-3 rounded-lg border-2 border-dashed border-line text-muted">
          Minecraft isn&apos;t answering right now. Health is measured while it runs.
        </p>
      ) : (
        <div className={dimmed ? 'opacity-60' : ''}>
          <div className="px-5 pb-4 flex items-end gap-3">
            <span className={`num font-semibold text-[34px] leading-10 ${dimmed ? 'text-muted' : text}`}>
              {health.tps !== null ? health.tps.toFixed(1) : '—'}
            </span>
            <span className="pb-1.5 text-muted">
              ticks per second{' '}
              <span className="text-faint">
                {health.stale
                  ? '· last reading'
                  : health.tps !== null
                  ? `· ${label.toLowerCase()} (20 is perfect)`
                  : '· needs RCON on the server'}
              </span>
            </span>
          </div>

          <dl className="mx-5 grid grid-cols-1 sm:grid-cols-3 border-t-2 border-rule divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-rule">
            <div className="py-3 sm:pr-4 flex sm:block items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted sm:text-xs">
                <Gauge className="w-4 h-4 text-info" aria-hidden="true" />
                Tick time
              </dt>
              <dd className="num font-semibold sm:mt-1.5 text-lg">
                {health.mspt !== null ? (
                  <>
                    {health.mspt.toFixed(1)} <span className="text-faint text-sm font-normal">ms</span>
                  </>
                ) : (
                  <Unavailable />
                )}
              </dd>
            </div>
            <div className="py-3 sm:px-4 min-w-0">
              <div className="flex sm:block items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-muted sm:text-xs">
                  <MemoryStick className="w-4 h-4 text-info" aria-hidden="true" />
                  Memory
                </dt>
                <dd className="num font-semibold sm:mt-1.5 text-lg">
                  {health.rssBytes !== null ? (
                    <>
                      {formatBytes(health.rssBytes)}
                      {health.memTotalBytes !== null && (
                        <span className="text-faint text-sm font-normal"> of {formatBytes(health.memTotalBytes)}</span>
                      )}
                    </>
                  ) : (
                    <Unavailable />
                  )}
                </dd>
              </div>
              {memRatio !== null && (
                <div
                  className="mt-2 flex gap-[3px] p-[3px] rounded-md border-2 border-edge bg-raised"
                  role="meter"
                  aria-label={`Memory used: ${Math.round(memRatio * 100)}%`}
                  aria-valuenow={Math.round(memRatio * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {Array.from({ length: segments }, (_, i) => (
                    <span
                      key={i}
                      className={`h-2 flex-1 rounded-[2px] ${i < lit ? (memRatio > 0.9 ? 'bg-negative' : 'bg-grass') : 'bg-surface'}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="py-3 sm:pl-4 flex sm:block items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted sm:text-xs">
                <Clock className="w-4 h-4 text-info" aria-hidden="true" />
                Uptime
              </dt>
              <dd className="num font-semibold sm:mt-1.5 text-lg">
                {health.uptimeSec !== null ? formatDuration(health.uptimeSec * 1000) : <Unavailable />}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="px-5 py-3 border-t-2 border-rule text-xs text-faint">
        {health.at ? (
          <>
            {health.stale ? 'Last reading ' : 'As of '}
            <time dateTime={health.at}>{formatRelative(health.at)}</time>
            {health.stale ? ': arm-free has not reported since.' : ', from arm-free.'}
          </>
        ) : (
          'No readings yet.'
        )}
      </p>
    </section>
  );
};
