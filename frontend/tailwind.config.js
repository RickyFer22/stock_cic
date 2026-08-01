/**
 * Token semántico con soporte de opacidad.
 *
 * Un token declarado como el string 'var(--color-x)' NO admite el modificador de
 * Tailwind: `border-state-warn/40` no generaba ninguna regla y el borde caía
 * callado en el gris por defecto de preflight. Tailwind solo puede inyectar el
 * alfa si el color es una función, así que devolvemos color-mix cuando pide
 * opacidad y el var() pelado cuando no.
 */
const tok = (nombre) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `var(--color-${nombre})`
    : `color-mix(in oklab, var(--color-${nombre}) calc(${opacityValue} * 100%), transparent)`

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
        paper:   { DEFAULT: tok('paper'), 2: tok('paper-2'), 3: tok('paper-3') },
        ink:     { DEFAULT: tok('ink'), 2: tok('ink-2'), 3: tok('ink-3') },
        rule:    { DEFAULT: tok('rule'), strong: tok('rule-strong') },
        accent:  {
          DEFAULT: tok('accent'),
          strong:  tok('accent-strong'),
          soft:    tok('accent-soft'),
          ink:     tok('accent-ink'),
        },
        focus:   tok('focus'),
        state: {
          ok:        tok('ok'),      'ok-bg':     tok('ok-bg'),
          warn:      tok('warn'),    'warn-bg':   tok('warn-bg'),
          danger:    tok('danger'),  'danger-bg': tok('danger-bg'),
          info:      tok('info'),    'info-bg':   tok('info-bg'),
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

