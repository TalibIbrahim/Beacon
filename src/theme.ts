// Dark or light. With no saved choice Beacon follows the system (prefers-color-scheme, in CSS);
// a choice made with the toggle is saved in localStorage and set as data-theme on <html>.

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'beacon-theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode or blocked storage: the choice lasts for this visit only
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

// The browser chrome colour follows the page's top ground colour
function syncThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = getComputedStyle(document.documentElement).getPropertyValue('--ground-top').trim();
  if (meta && color) meta.setAttribute('content', color);
}

// Called once before the first render so a saved choice never flashes the other theme
export function applyTheme(theme: Theme | null): void {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  syncThemeColor();
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? systemTheme());

  // Follow the system until the visitor picks a theme themselves
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(LIGHT_QUERY);
    const onChange = () => {
      if (getStoredTheme()) return;
      setTheme(systemTheme());
      syncThemeColor();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      storeTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
