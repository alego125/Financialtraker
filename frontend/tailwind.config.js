/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['DM Sans', 'sans-serif'],
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
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          light:   'var(--gold)',
          dark:    '#183FA5',
          pale:    'var(--gold-pale)',
        },
        income:  'var(--income)',
        expense: 'var(--expense)',
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
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          light:   'rgb(var(--accent-rgb) / <alpha-value>)',
          glow:    'rgb(var(--accent-rgb) / .15)',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card':   '0 2px 12px 0 rgba(0,0,0,0.06)',
        'card-md':'0 4px 24px 0 rgba(0,0,0,0.10)',
        'gold':   '0 4px 20px 0 rgba(30,79,202,0.16)',
      },
    },
  },
  plugins: [],
}
