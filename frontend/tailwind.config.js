/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Montserrat"', 'ui-sans-serif', 'system-ui'],
        body: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          blue: {
            900: 'var(--sr-blue-900)',
            700: 'var(--sr-blue-700)',
            500: 'var(--sr-blue-500)',
          },
          green: {
            900: 'var(--sr-green-900)',
            700: 'var(--sr-green-700)',
            500: 'var(--sr-green-500)',
          },
          gold: {
            500: 'var(--sr-gold-500)',
          }
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
      boxShadow: {
        card: '0 14px 40px rgba(2, 6, 23, 0.10)',
      },
    },
  },
  plugins: [],
}

