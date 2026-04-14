/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Theme-aware via CSS vars
        surface:  'var(--surface)',
        surface2: 'var(--surface2)',
        border:   'var(--border)',
        text:     'var(--text)',
        muted:    'var(--muted)',
        subtle:   'var(--subtle)',
        // Fixed
        gold: {
          DEFAULT: '#E8A020',
          light:   '#F5BD4A',
          dark:    '#C8861A',
          pale:    '#FDF3DC',
        },
        income:  '#16A34A',
        expense: '#DC2626',
        // Dark theme palette (kept for explicit use)
        dark: {
          900: '#080c14',
          800: '#0d1220',
          700: '#111827',
          600: '#1a2336',
          500: '#243044',
          400: '#2e3d57',
        },
        accent: {
          DEFAULT: '#1a7fd4',
          light:   '#4da6f5',
          glow:    '#1a7fd433',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card':   '0 2px 12px 0 rgba(0,0,0,0.06)',
        'card-md':'0 4px 24px 0 rgba(0,0,0,0.10)',
        'gold':   '0 4px 20px 0 rgba(232,160,32,0.25)',
      },
    },
  },
  plugins: [],
}
