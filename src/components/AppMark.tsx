import React from 'react';

// Beacon's mark: a pixel beacon block sending its beam up (same drawing as the status icon, lit)
export const AppMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={(size * 12) / 16} height={size} viewBox="0 0 12 16" aria-hidden="true" className="pixelated shrink-0">
    <rect x="4" y="0" width="4" height="5" className="fill-beam" />
    <rect x="0" y="5" width="12" height="11" className="fill-obsidian" />
    <rect x="1" y="6" width="10" height="9" className="fill-raised" />
    <rect x="3" y="8" width="6" height="5" className="fill-obsidian" />
    <rect x="4" y="9" width="4" height="3" className="fill-beam" />
  </svg>
);
