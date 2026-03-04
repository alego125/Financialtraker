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
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a24',
          600: '#22222f',
          500: '#2e2e3e',
          400: '#3d3d52',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          glow: '#7c3aed33',
        },
        income: '#10b981',
        expense: '#f43f5e',
      }
    },
  },
  plugins: [],
}
