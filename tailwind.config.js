/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Charcoal / graphite — the grounding dark tones
        charcoal: {
          DEFAULT: '#1c1a18',
          800: '#232120',
          700: '#2e2b29',
          600: '#3a3633',
        },
        graphite: '#4a4541',
        // Warm beige / sand — the showroom warmth
        sand: {
          DEFAULT: '#d8c7ad',
          light: '#e7dcc9',
          dark: '#c4ac88',
        },
        // Off-white surfaces
        cream: '#f6f1e7',
        // Accents (used sparingly)
        gold: {
          DEFAULT: '#b08d4f',
          light: '#c9a86a',
          dark: '#8a6d39',
        },
        terracotta: '#b5613f',
      },
      fontFamily: {
        // Refined high-contrast serif for showroom-luxury headings
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Clean modern sans for body
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(20, 18, 16, 0.35)',
        glow: '0 0 50px -8px rgba(176, 141, 79, 0.45)',
        card: '0 22px 60px -20px rgba(20, 18, 16, 0.55)',
      },
      backgroundImage: {
        'grout-lines':
          'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'fade-up': 'fade-up 0.7s ease forwards',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
