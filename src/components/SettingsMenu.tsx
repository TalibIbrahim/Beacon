import React, { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { useBands } from '../settings';

// A switch row: the whole row is the control, 44px+ tall, state in words as well as position
const SwitchRow: React.FC<{ label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  hint,
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full min-h-[52px] flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg text-left hover:bg-raised"
  >
    <span className="min-w-0">
      <span className="block font-medium text-ink">{label}</span>
      <span className="block text-xs text-faint">{hint}</span>
    </span>
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-semibold text-muted w-6 text-right">{checked ? 'On' : 'Off'}</span>
      <span
        className={`relative w-11 h-6 rounded-md border-2 border-edge transition-colors ${checked ? 'bg-accent' : 'bg-raised'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-[3px] bg-ink border border-obsidian transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </span>
  </button>
);

export const SettingsMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { bands, setBands } = useBands();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on a click outside or Escape, handing focus back to the gear
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        aria-controls="settings-panel"
      >
        <Settings className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="settings-panel"
          role="group"
          aria-label="Settings"
          // Phones: pinned to the page gutters under the header. From sm: hangs from the gear.
          className="panel fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+70px)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 p-2 z-50 animate-toast-in"
        >
          <div className="px-3 pt-2 pb-1 card-title text-[15px]">Settings</div>
          <SwitchRow
            label="Colour bands on cards"
            hint="The grass, sky, dirt and stone strips on top of each card"
            checked={bands}
            onChange={setBands}
          />
        </div>
      )}
    </div>
  );
};
