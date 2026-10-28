/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable from src/index.css, so the dark and light themes swap in one place.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        line: 'var(--border)',
        rule: 'var(--rule)',
        control: 'var(--control)',
        edge: 'var(--edge)',
        obsidian: 'var(--obsidian)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-ink': 'var(--accent-ink)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        'on-negative': 'var(--on-negative)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        'pill-positive': 'var(--pill-positive-bg)',
        'pill-negative': 'var(--pill-negative-bg)',
        'pill-warning': 'var(--pill-warning-bg)',
        'pill-info': 'var(--pill-info-bg)',
        grass: 'var(--grass)',
        dirt: 'var(--dirt)',
        stone: 'var(--stone)',
        sky: 'var(--sky)',
        beam: 'var(--beam)',
      },
      borderRadius: {
        card: 'var(--radius)',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Pixelify Sans"', '"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 160ms ease-out',
        'dialog-in': 'dialog-in 140ms ease-out',
      },
    },
  },
  plugins: [],
};
