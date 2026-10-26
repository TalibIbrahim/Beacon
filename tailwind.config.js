/** @type {import('tailwindcss').Config} */
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
        ink: 'var(--text)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        warning: 'var(--warning)',
        'pill-positive': 'var(--pill-positive-bg)',
        'pill-negative': 'var(--pill-negative-bg)',
        'pill-warning': 'var(--pill-warning-bg)',
      },
      borderRadius: {
        card: '6px',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
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
