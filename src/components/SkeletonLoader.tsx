import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Trial banner skeleton */}
      <div className="h-12 bg-surface-card rounded-xl border border-white/[0.04]" />

      {/* Server Status skeleton */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.06] space-y-5">
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.04]">
          <div className="space-y-2">
            <div className="h-3 w-28 bg-white/[0.05] rounded" />
            <div className="h-6 w-48 bg-white/[0.08] rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-white/[0.05] rounded-xl" />
            <div className="h-8 w-32 bg-white/[0.05] rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-20 bg-surface-card rounded-xl border border-white/[0.04]" />
          <div className="h-20 bg-surface-card rounded-xl border border-white/[0.04]" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.06] space-y-4">
        <div className="h-5 w-36 bg-white/[0.08] rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-14 bg-surface-card rounded-xl border border-white/[0.04]" />
          <div className="h-14 bg-surface-card rounded-xl border border-white/[0.04]" />
          <div className="h-14 bg-surface-card rounded-xl border border-white/[0.04]" />
        </div>
      </div>

      {/* Players & Activity Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 glass-panel rounded-2xl border border-white/[0.06] p-6 space-y-4">
          <div className="h-5 w-32 bg-white/[0.08] rounded" />
          <div className="h-20 bg-surface-card rounded-xl" />
          <div className="h-20 bg-surface-card rounded-xl" />
        </div>
        <div className="h-64 glass-panel rounded-2xl border border-white/[0.06] p-6 space-y-4">
          <div className="h-5 w-32 bg-white/[0.08] rounded" />
          <div className="h-10 bg-surface-card rounded-lg" />
          <div className="h-10 bg-surface-card rounded-lg" />
          <div className="h-10 bg-surface-card rounded-lg" />
        </div>
      </div>
    </div>
  );
};
