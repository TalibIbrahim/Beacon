import React from 'react';
import { CalendarClock, Coins, Cpu } from 'lucide-react';
import { formatMoney } from '../format';
import { ComputeUsage } from '../types';

interface UsageCardProps {
  usage?: ComputeUsage;
  trialDaysLeft: number | null;
  region: string;
}

// A segmented bar, like an XP bar: one segment per unit up to 12, then scaled
const Meter: React.FC<{ label: string; value: number; max: number; unit: string }> = ({ label, value, max, unit }) => {
  const segments = max > 0 ? Math.min(12, Math.max(1, Math.round(max))) : 1;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const lit = Math.round(ratio * segments);
  const over = value > max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="num">
          <span className={`font-semibold ${over ? 'text-negative' : 'text-ink'}`}>{value}</span>
          <span className="text-faint">
            {' '}
            of {max} {unit}
          </span>
        </span>
      </div>
      <div
        className="mt-2 flex gap-[3px] p-[3px] rounded-md border-2 border-edge bg-raised"
        role="meter"
        aria-label={`${label}: ${value} of ${max} ${unit}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-[2px] ${i < lit ? (over ? 'bg-negative' : 'bg-grass') : 'bg-surface'}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
};

export const UsageCard: React.FC<UsageCardProps> = ({ usage, trialDaysLeft, region }) => {
  if (!usage) return null;

  const monthly = usage.estimatedHourlyCost * 24 * 30;
  const { maxOcpus, maxMemoryGBs } = usage.freeTierLimit;
  const fitsFree = usage.ocpus <= maxOcpus && usage.memoryInGBs <= maxMemoryGBs;
  const trialUrgent = trialDaysLeft !== null && trialDaysLeft <= 7;

  const cells: Array<{ label: string; icon: React.ReactNode; tint: string; value: React.ReactNode; sub: React.ReactNode }> = [
    {
      label: 'Size',
      icon: <Cpu className="w-4 h-4" aria-hidden="true" />,
      tint: 'text-info',
      value: (
        <>
          {usage.ocpus} <span className="text-faint text-sm">OCPU</span> · {usage.memoryInGBs}{' '}
          <span className="text-faint text-sm">GB</span>
        </>
      ),
      sub: `${usage.vcpus} vCPU · ${usage.processor}`,
    },
    {
      label: 'Cost while running',
      icon: <Coins className="w-4 h-4" aria-hidden="true" />,
      tint: 'text-warning',
      value: usage.isAlwaysFreeShape ? (
        '$0'
      ) : (
        <>
          {formatMoney(usage.estimatedHourlyCost, 3)}
          <span className="text-faint text-sm"> /h</span>
        </>
      ),
      sub: usage.isAlwaysFreeShape ? 'Always Free shape' : `≈ ${formatMoney(monthly)} per 30 days, est.`,
    },
    {
      label: 'Trial credit',
      icon: <CalendarClock className="w-4 h-4" aria-hidden="true" />,
      tint: trialUrgent ? 'text-negative' : 'text-positive',
      value:
        trialDaysLeft === null ? (
          <span className="text-faint">—</span>
        ) : (
          <span className={trialUrgent ? 'text-warning' : undefined}>
            {trialDaysLeft} <span className="text-faint text-sm">{trialDaysLeft === 1 ? 'day' : 'days'}</span>
          </span>
        ),
      sub:
        trialDaysLeft === null
          ? 'Set TRIAL_END to track it'
          : trialDaysLeft === 0
          ? 'Ended. Download the world now.'
          : trialUrgent
          ? 'Download the world before it ends'
          : 'left on the Oracle trial',
    },
  ];

  return (
    <section className="panel band-stone" aria-labelledby="usage-heading">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 pt-6 pb-3">
        <h2 id="usage-heading" className="card-title">
          Oracle Cloud
        </h2>
        <span className="text-muted truncate max-w-full">
          {usage.shape} · {region}
        </span>
      </header>

      {/* One row split by rules on desktop; label/value rows on phones */}
      <dl className="mx-5 grid grid-cols-1 sm:grid-cols-3 border-y-2 border-rule divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-rule">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="min-w-0 py-3 sm:py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0 flex sm:block items-start justify-between gap-4"
          >
            <dt className="flex items-center gap-2 text-muted shrink-0 sm:text-xs">
              <span className={cell.tint}>{cell.icon}</span>
              {cell.label}
            </dt>
            <dd className="min-w-0 text-right sm:text-left sm:mt-2">
              <span className="block text-lg sm:text-xl leading-7 font-semibold num">{cell.value}</span>
              <span className="block mt-0.5 text-xs text-faint truncate">{cell.sub}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-5 pt-5 pb-5 grid gap-5 sm:grid-cols-2">
        <p className="text-muted sm:col-span-2">
          {usage.isAlwaysFreeShape
            ? 'This VM runs on an Always Free shape, so it costs nothing to keep.'
            : fitsFree
            ? `This VM's size fits Oracle's Always Free Ampere A1 allowance (${maxOcpus} OCPU, ${maxMemoryGBs} GB), so the world can move there and run for $0.`
            : `This VM is larger than Oracle's Always Free Ampere A1 allowance (${maxOcpus} OCPU, ${maxMemoryGBs} GB). Shrink it before moving to the free tier.`}
        </p>
        <Meter label="CPU" value={usage.ocpus} max={maxOcpus} unit="OCPU" />
        <Meter label="Memory" value={usage.memoryInGBs} max={maxMemoryGBs} unit="GB" />
      </div>
    </section>
  );
};
