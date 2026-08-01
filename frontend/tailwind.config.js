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
        /* Tokens semánticos del sistema (design.md). Se usan por nombre —
           bg-paper, text-ink-2, border-rule— y responden solos al tema oscuro
           porque son variables CSS, no valores fijos. */
        paper:   { DEFAULT: 'var(--color-paper)', 2: 'var(--color-paper-2)', 3: 'var(--color-paper-3)' },
        ink:     { DEFAULT: 'var(--color-ink)', 2: 'var(--color-ink-2)', 3: 'var(--color-ink-3)' },
        rule:    { DEFAULT: 'var(--color-rule)', strong: 'var(--color-rule-strong)' },
        accent:  {
          DEFAULT: 'var(--color-accent)',
          strong:  'var(--color-accent-strong)',
          soft:    'var(--color-accent-soft)',
          ink:     'var(--color-accent-ink)',
        },
        focus:   'var(--color-focus)',
        state: {
          ok:        'var(--color-ok)',      'ok-bg':     'var(--color-ok-bg)',
          warn:      'var(--color-warn)',    'warn-bg':   'var(--color-warn-bg)',
          danger:    'var(--color-danger)',  'danger-bg': 'var(--color-danger-bg)',
          info:      'var(--color-info)',    'info-bg':   'var(--color-info-bg)',
        },
        brand: {
          blue: {
            900: 'var(--sr-blue-900)',
            700: 'var(--sr-blue-700)',
            500: 'var(--sr-blue-500)',
          },
          green: {
            50:  'var(--sr-green-50)',
            100: 'var(--sr-green-100)',
            200: 'var(--sr-green-200)',
            500: 'var(--sr-green-500)',
            600: 'var(--sr-green-600)',
            700: 'var(--sr-green-700)',
            800: 'var(--sr-green-800)',
            900: 'var(--sr-green-900)',
          },
          gold: {
            50:  'var(--sr-gold-50)',
            100: 'var(--sr-gold-100)',
            500: 'var(--sr-gold-500)',
            600: 'var(--sr-gold-600)',
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

