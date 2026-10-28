import React from 'react';

// The final layout with flat bars where values will land, so nothing shifts when data arrives
const Bar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`rounded-md bg-raised ${className}`} aria-hidden="true" />
);

const PanelSkeleton: React.FC<{ title: string; rows: number; band: string }> = ({ title, rows, band }) => (
  <div className={`panel ${band}`}>
    <div className="px-5 pt-6 pb-3 card-title text-faint">{title}</div>
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
      <div className="panel band-stone">
        <div className="pt-7 pb-5 px-6 flex flex-col sm:flex-row sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <Bar className="h-[72px] w-[46px]" />
            <Bar className="h-10 w-40" />
          </div>
          <Bar className="h-11 w-64" />
        </div>
        <div className="border-t-2 border-rule grid grid-cols-4 gap-4 px-6 pt-4 pb-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-7 w-7" />
              <Bar className="h-4" />
            </div>
          ))}
        </div>
      </div>
      <PanelSkeleton title="World save" rows={3} band="band-dirt" />
      <PanelSkeleton title="Backups" rows={4} band="band-stone" />
    </div>
    <div className="flex flex-col gap-6">
      <PanelSkeleton title="Players" rows={2} band="band-sky" />
      <PanelSkeleton title="Recent activity" rows={5} band="band-stone" />
    </div>
  </div>
);
