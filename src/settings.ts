// Display preferences from the Settings menu. Stored per browser (localStorage, wrapped in
// try/catch) and applied as data attributes on <html>, which the CSS reads.

import { useCallback, useState } from 'react';

const BANDS_KEY = 'beacon-bands';

// The coloured strips on top of each card (grass, sky, dirt, stone). On unless switched off.
export function getBandsEnabled(): boolean {
  try {
    return localStorage.getItem(BANDS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function applyBands(enabled: boolean): void {
  if (enabled) delete document.documentElement.dataset.bands;
  else document.documentElement.dataset.bands = 'off';
}

export function useBands(): { bands: boolean; setBands: (enabled: boolean) => void } {
  const [bands, setState] = useState(getBandsEnabled);
  const setBands = useCallback((enabled: boolean) => {
    setState(enabled);
    applyBands(enabled);
    try {
      localStorage.setItem(BANDS_KEY, enabled ? 'on' : 'off');
    } catch {
      // blocked storage: the choice lasts for this visit only
    }
  }, []);
  return { bands, setBands };
}
