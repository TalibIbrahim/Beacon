import React from 'react';

// Beacon's mark: a beacon block sending its beam up
export const AppMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
    <path d="M10 1.5v8" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
    <rect x="3.75" y="11.25" width="12.5" height="7" rx="1" className="fill-none stroke-ink" strokeWidth="1.5" />
    <rect x="7.5" y="13.5" width="5" height="2.5" rx="0.5" className="fill-accent" />
  </svg>
);
