import React from 'react';
import { Cpu, HardDrive, Sparkles, AlertCircle } from 'lucide-react';
import { ComputeUsage } from '../types';

interface UsageCardProps {
  usage?: ComputeUsage;
  trialDaysLeft: number;
}

export const UsageCard: React.FC<UsageCardProps> = ({ usage, trialDaysLeft }) => {
  if (!usage) return null;

  const ocpuPercent = Math.min(100, Math.round((usage.ocpus / usage.freeTierLimit.maxOcpus) * 100));
  const memPercent = Math.min(100, Math.round((usage.memoryInGBs / usage.freeTierLimit.maxMemoryGBs) * 100));

  const getWidthClass = (pct: number) => {
    if (pct <= 0) return 'w-0';
    if (pct <= 25) return 'w-1/4';
    if (pct <= 50) return 'w-1/2';
    if (pct <= 75) return 'w-3/4';
    return 'w-full';
  };

  const dailyCost = (usage.estimatedHourlyCost * 24).toFixed(2);
  const monthlyCost = (usage.estimatedHourlyCost * 24 * 30).toFixed(2);

  return (
    <div className="carbon-panel rounded-2xl p-6 border border-white/[0.08] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Compute &amp; Trial Telemetry</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              TRIAL TIER
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Resource quota consumption &amp; Oracle Always Free Ampere allowance comparison
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-neutral-500">TRIAL DAYS:</span>
          <span className="font-bold text-white">{trialDaysLeft} DAYS</span>
        </div>
      </div>

      {/* Grid: Compute Specs + Trial Cost Burn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Allocated Specs */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
          <div className="text-xs font-mono text-neutral-400 flex items-center justify-between">
            <span>ALLOCATED HARDWARE</span>
            <span className="text-neutral-300 font-semibold">{usage.shape}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono text-neutral-500">CPU CORES</div>
                <div className="text-xs font-mono font-bold text-white">
                  {usage.ocpus} OCPU <span className="text-neutral-500 font-normal">({usage.vcpus} vCPU)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono text-neutral-500">RAM MEMORY</div>
                <div className="text-xs font-mono font-bold text-white">
                  {usage.memoryInGBs} GB
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] font-mono text-neutral-500 border-t border-white/[0.04] truncate">
            {usage.processor} · {usage.networkGbps} Gbps
          </div>
        </div>

        {/* Burn Rate & Cost */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
          <div className="text-xs font-mono text-neutral-400 flex items-center justify-between">
            <span>$300 TRIAL CREDIT BURN</span>
            <span className="text-amber-400 font-bold font-mono">-${dailyCost}/DAY</span>
          </div>

          <div className="flex items-baseline gap-2 pt-1 font-mono">
            <div className="text-2xl font-bold text-white">${usage.estimatedHourlyCost}</div>
            <div className="text-xs text-neutral-400">/ hour (~${monthlyCost} / mo)</div>
          </div>

          <div className="text-[11px] text-neutral-400 leading-snug">
            Deducted from your $300 trial credits while running on AMD E5.
          </div>
        </div>
      </div>

      {/* Always Free Ampere Target Comparison */}
      <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>ORACLE ALWAYS FREE AMPERE (A1.FLEX) MIGRATION TARGET</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
            $0 / MONTH FOREVER
          </span>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed font-sans">
          Oracle gives <strong className="text-white">4 OCPUs &amp; 24 GB RAM</strong> for free on Ampere A1 (ARM). Your current VM uses <strong>50%</strong> of that free capacity.
        </p>

        {/* Comparison bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono text-xs">
          {/* OCPU Comparison */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Compute Allocation:</span>
              <span className="text-neutral-200 font-bold">{usage.ocpus} / {usage.freeTierLimit.maxOcpus} OCPUs</span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
              <div
                className={`bg-emerald-400 h-full rounded-full transition-all duration-500 ${getWidthClass(ocpuPercent)}`}
              />
            </div>
          </div>

          {/* Memory Comparison */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Memory Allocation:</span>
              <span className="text-neutral-200 font-bold">{usage.memoryInGBs} / {usage.freeTierLimit.maxMemoryGBs} GB RAM</span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
              <div
                className={`bg-emerald-400 h-full rounded-full transition-all duration-500 ${getWidthClass(memPercent)}`}
              />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-emerald-500/20 flex items-start gap-2 text-[11px] text-neutral-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Dubai (<code className="text-neutral-300">me-dubai-1</code>) Ampere capacity is currently constrained. Before your 36-day trial ends, you can retry provisioning <code className="text-neutral-300">VM.Standard.A1.Flex</code> or create a volume backup so your world transfers seamlessly!
          </span>
        </div>
      </div>
    </div>
  );
};
