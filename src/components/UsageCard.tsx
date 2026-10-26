import React from 'react';
import { formatMoney } from '../format';
import { ComputeUsage } from '../types';

interface UsageCardProps {
  usage?: ComputeUsage;
  trialDaysLeft: number | null;
  region: string;
}

const Meter: React.FC<{ label: string; value: number; max: number; unit: string }> = ({ label, value, max, unit }) => {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const over = value > max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="num">
          <span className={over ? 'text-negative' : 'text-ink'}>{value}</span>
          <span className="text-faint">
            {' '}
            of {max} {unit}
          </span>
        </span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full bg-raised overflow-hidden"
        role="meter"
        aria-label={`${label}: ${value} of ${max} ${unit}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`h-full rounded-full ${over ? 'bg-negative' : 'bg-muted'}`} style={{ width: `${ratio * 100}%` }} />
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

  const cells: Array<{ label: string; value: React.ReactNode; sub: React.ReactNode }> = [
    {
      label: 'Size',
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
    <section className="panel" aria-labelledby="usage-heading">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 pt-4 pb-3">
        <h2 id="usage-heading" className="text-base font-semibold">
          Oracle Cloud
        </h2>
        <span className="text-muted truncate max-w-full">
          {usage.shape} · {region}
        </span>
      </header>

      <dl className="grid grid-cols-1 sm:grid-cols-3 border-y border-line">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="px-5 py-4 border-t border-line first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 min-w-0"
          >
            <dt className="label">{cell.label}</dt>
            <dd className="mt-1 text-xl leading-7 num">{cell.value}</dd>
            <dd className="mt-0.5 text-xs text-faint truncate">{cell.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="px-5 py-5 grid gap-5 sm:grid-cols-2">
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
