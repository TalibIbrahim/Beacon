import React from 'react';

// The final layout with flat bars where values will land, so nothing shifts when data arrives
const Bar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`rounded bg-raised ${className}`} aria-hidden="true" />
);

const PanelSkeleton: React.FC<{ title: string; rows: number }> = ({ title, rows }) => (
  <div className="panel">
    <div className="px-5 pt-4 pb-3 text-base font-semibold text-faint">{title}</div>
    <div className="px-5 pb-5 space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Bar key={i} className="h-5 w-full" />
      ))}
    </div>
  </div>
);

export const SkeletonLoader: React.FC = () => (
  <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" aria-busy="true">
    <span className="sr-only">Loading server status…</span>
    <div className="flex flex-col gap-6">
      <div className="panel">
        <div className="p-6 flex flex-col sm:flex-row sm:justify-between gap-6">
          <Bar className="h-9 w-40" />
          <Bar className="h-9 w-64" />
        </div>
        <div className="border-t border-line grid grid-cols-4 gap-6 px-6 py-5">
          <Bar className="h-4" />
          <Bar className="h-4" />
          <Bar className="h-4" />
          <Bar className="h-4" />
        </div>
      </div>
      <PanelSkeleton title="World save" rows={3} />
      <PanelSkeleton title="Oracle Cloud" rows={4} />
    </div>
    <div className="flex flex-col gap-6">
      <PanelSkeleton title="Players" rows={2} />
      <PanelSkeleton title="Recent activity" rows={5} />
    </div>
  </div>
);
