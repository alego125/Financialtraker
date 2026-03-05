/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
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
          light: '#4da6f5',
          glow: '#1a7fd433',
        },
        gold: {
          DEFAULT: '#f5a623',
          light: '#fbbf24',
          dark:  '#d4891a',
        },
        income: '#22c55e',
        expense: '#f43f5e',
      }
    },
  },
  plugins: [],
}
