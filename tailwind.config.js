/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // PRD §2.2 — Color System. Existing names remapped to PRD hex values
        // so every existing class auto-reskins. New code should use the
        // semantic aliases below (primary, accent-gold, etc.).
        charcoal: {
          DEFAULT: '#2C1A0E',   // --bg-primary  (was #1c1a18)
          800: '#3D2512',       // --bg-secondary (was #232120)
          700: '#4A2E1A',       // --bg-surface   (was #2e2b29)
          600: '#5C3A22',       // hover/elevated (was #3a3633)
        },
        graphite: '#6B4A2E',
        sand: {
          DEFAULT: '#C9A97A',   // --text-secondary
          light: '#E0C99B',
          dark: '#A8884F',
        },
        cream: '#F5E6C8',       // --text-primary
        gold: {
          DEFAULT: '#C49A3C',   // --accent-gold
          light: '#D9B156',
          dark: '#9A7530',
        },
        terracotta: '#B85C38',  // --accent-terracotta
        ink: '#1A0E05',         // --text-on-accent (NEW)

        // Semantic aliases — PRD token names for new code.
        primary: '#2C1A0E',
        secondary: '#3D2512',
        surface: '#4A2E1A',
        'text-primary': '#F5E6C8',
        'text-secondary': '#C9A97A',
        'accent-gold': '#C49A3C',
        'accent-terracotta': '#B85C38',
        'text-on-accent': '#1A0E05',
      },
      spacing: {
        // PRD §2.4 — 8px grid additions (Tailwind's default 4px scale remains).
        '7': '1.75rem',   '9': '2.25rem',  '15': '3.75rem',
        '17': '4.25rem',  '18': '4.5rem',
      },
      borderRadius: {
        // PRD §2.4 — cards 4px (architectural), buttons 2px (sharp luxury).
        card: '4px',
        btn: '2px',
      },
      transitionDuration: {
        // PRD §2.5 — micro 150ms, reveals 400-600ms.
        '150': '150ms', '400': '400ms', '500': '500ms', '600': '600ms',
      },
      transitionTimingFunction: {
        // PRD §2.5 — cubic-bezier(0.4, 0, 0.2, 1) for UI.
        pr: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      fontFamily: {
        // Refined high-contrast serif for showroom-luxury headings
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Clean modern sans for body
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(44, 26, 14, 0.35)',
        glow: '0 0 50px -8px rgba(196, 154, 60, 0.45)',
        card: '0 22px 60px -20px rgba(44, 26, 14, 0.55)',
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
        'fade-up': 'fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
