// Beacon's pixel art, drawn as inline SVG on small grids (no images: the CSP allows none from
// elsewhere, and these stay crisp at any size). All colours come from the theme tokens.

import React, { useEffect, useState } from 'react';
import { Phase } from '../serverState';

type Px = [x: number, y: number, w?: number, h?: number];

const Pixels: React.FC<{ px: Px[]; className: string }> = ({ px, className }) => (
  <>
    {px.map(([x, y, w = 1, h = 1]) => (
      <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} className={className} />
    ))}
  </>
);

// --- The beacon block: the status icon -----------------------------------------------------------
// A glass block on an obsidian base with a core that lights up, and a beam that grows with the boot.

const CORE: Record<Phase, string> = {
  off: 'fill-stone',
  booting: 'fill-warning',
  loading: 'fill-warning',
  online: 'fill-beam',
  stopping: 'fill-warning',
  unknown: 'fill-negative',
};

export const PixelBeacon: React.FC<{ phase: Phase; size?: number; className?: string }> = ({
  phase,
  size = 64,
  className = '',
}) => {
  // Beam height in pixels above the block (the block starts at y = 9)
  const beam = { off: 0, booting: 3, loading: 6, online: 9, stopping: 2, unknown: 0 }[phase];
  const beamAnim = phase === 'online' ? 'anim-beam' : phase === 'booting' || phase === 'loading' ? 'anim-flicker' : '';

  return (
    <svg
      viewBox="0 0 16 25"
      width={(size * 16) / 25}
      height={size}
      className={`pixelated shrink-0 ${className}`}
      aria-hidden="true"
    >
      {beam > 0 && <rect x="6" y={9 - beam} width="4" height={beam} className={`fill-beam ${beamAnim}`} />}
      {phase === 'online' && (
        <g className="anim-beam">
          <Pixels px={[[3, 2], [12, 4], [2, 6], [13, 1]]} className="fill-beam" />
        </g>
      )}
      {/* outline, glass, highlight */}
      <rect x="0" y="9" width="16" height="16" className="fill-obsidian" />
      <rect x="1" y="10" width="14" height="14" className="fill-raised" />
      <Pixels px={[[2, 11, 3], [2, 12]]} className="fill-ink opacity-40" />
      {/* obsidian base */}
      <rect x="1" y="20" width="14" height="4" className="fill-obsidian opacity-70" />
      <Pixels px={[[3, 21], [8, 22], [12, 21]]} className="fill-control opacity-60" />
      {/* the core */}
      <rect x="4" y="12" width="8" height="7" className="fill-obsidian" />
      <rect x="5" y="13" width="6" height="5" className={`${CORE[phase]} ${phase === 'off' ? 'anim-sleepy' : ''}`} />
      {phase !== 'off' && phase !== 'unknown' && <rect x="5" y="13" width="2" height="1" className="fill-ink opacity-50" />}
      {phase === 'unknown' && <Pixels px={[[7, 13, 2, 3], [7, 17, 2, 1]]} className="fill-obsidian" />}
    </svg>
  );
};

// --- Boot track blocks --------------------------------------------------------------------------

export type BlockKind = 'stone' | 'dirt' | 'grass' | 'beacon';

// 30px on phones, 40px from sm up: whole multiples of the 10-pixel grid, so edges stay crisp
export const PixelBlock: React.FC<{ kind: BlockKind; filled: boolean; className?: string }> = ({
  kind,
  filled,
  className = '',
}) => (
  <svg viewBox="0 0 10 10" className={`pixelated shrink-0 w-[30px] h-[30px] sm:w-10 sm:h-10 ${className}`} aria-hidden="true">
    {filled ? (
      <>
        <rect x="0" y="0" width="10" height="10" className="fill-obsidian" />
        {kind === 'stone' && (
          <>
            <rect x="1" y="1" width="8" height="8" className="fill-stone" />
            <Pixels px={[[2, 2, 2], [6, 3], [3, 6, 2], [7, 6], [5, 8]]} className="fill-obsidian opacity-30" />
          </>
        )}
        {kind === 'dirt' && (
          <>
            <rect x="1" y="1" width="8" height="8" className="fill-dirt" />
            <Pixels px={[[2, 2], [6, 2, 2], [4, 5], [7, 6], [2, 7, 2]]} className="fill-obsidian opacity-30" />
          </>
        )}
        {kind === 'grass' && (
          <>
            <rect x="1" y="1" width="8" height="8" className="fill-dirt" />
            <rect x="1" y="1" width="8" height="3" className="fill-grass" />
            <Pixels px={[[2, 4], [5, 4, 2], [8, 4]]} className="fill-grass" />
            <Pixels px={[[3, 6], [6, 7, 2]]} className="fill-obsidian opacity-30" />
          </>
        )}
        {kind === 'beacon' && (
          <>
            <rect x="1" y="1" width="8" height="8" className="fill-raised" />
            <rect x="3" y="3" width="4" height="4" className="fill-beam" />
            <rect x="1" y="7" width="8" height="2" className="fill-obsidian opacity-70" />
            <rect x="2" y="2" width="2" height="1" className="fill-ink opacity-40" />
          </>
        )}
      </>
    ) : (
      // Not reached yet: an empty slot, drawn as an outline so it differs by shape, not only colour
      <rect x="0.75" y="0.75" width="8.5" height="8.5" className="fill-none stroke-control" strokeWidth="1" strokeDasharray="1 1" />
    )}
  </svg>
);

// --- Player avatars ------------------------------------------------------------------------------
// 8x8, mirrored left to right, from a hash of the name: the same friend always gets the same face.

function fnv1a(text: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export const PixelAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 32 }) => {
  const bits = fnv1a(name.toLowerCase());
  const hue = fnv1a(name.toLowerCase(), 0x9e3779b9) % 360;
  const cells: Px[] = [];
  // 32 bits fill the left half (4 columns x 8 rows); the right half mirrors it
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      if ((bits >>> (row * 4 + col)) & 1) {
        cells.push([col, row], [7 - col, row]);
      }
    }
  }
  return (
    <svg
      viewBox="-1 -1 10 10"
      width={size}
      height={size}
      className="pixelated pixel-avatar shrink-0 rounded-md border-2 border-edge"
      style={{ '--h': hue } as React.CSSProperties}
      aria-hidden="true"
    >
      <rect x="-1" y="-1" width="10" height="10" className="avatar-bg" />
      <Pixels px={cells} className="avatar-fg" />
    </svg>
  );
};

// --- The Online burst ----------------------------------------------------------------------------
// A few pixel squares thrown out once when the server comes online. Hidden with reduced motion.

const BURST_COLORS = ['bg-beam', 'bg-grass', 'bg-warning', 'bg-sky', 'bg-positive'];

export const PixelBurst: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [bits] = useState(() =>
    Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 48 + Math.random() * 46;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 14,
        rot: Math.round((Math.random() - 0.5) * 240),
        size: i % 3 === 0 ? 8 : 6,
        color: BURST_COLORS[i % BURST_COLORS.length],
      };
    })
  );

  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <span className="pixel-burst pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className={`pixel-burst-bit absolute block border border-obsidian ${b.color}`}
          style={
            {
              width: b.size,
              height: b.size,
              '--dx': `${b.dx}px`,
              '--dy': `${b.dy}px`,
              '--rot': `${b.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
};
