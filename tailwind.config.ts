import type { Config } from 'tailwindcss'

/**
 * The palette is the one the customer-facing pages already use (wwwroot/brand/README.md and
 * Pages/KycResult.cshtml), not a new one invented for the dashboard: brand purple #43156B with the
 * orange mark from the logo. Keeping them identical means the operator screens and the page a
 * customer sees are recognisably the same product.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F0FA',
          100: '#ECE6F1',
          200: '#DCC9EC',
          300: '#BCA8D0',
          400: '#8A5FB0',
          500: '#6B33A0',
          600: '#5C2490',
          700: '#4E1A7A',
          800: '#43156B',
          900: '#331050',
          950: '#241634',
        },
        accent: {
          50: '#FEF2ED',
          100: '#FDE0D4',
          200: '#FAC1A9',
          300: '#F59B76',
          400: '#F0834F',
          500: '#EE7148',
          600: '#E0483C',
          700: '#C0362C',
          800: '#9A2C24',
          900: '#7C261F',
        },
        ink: '#241634',
        muted: '#8A7F95',
        line: '#ECE6F1',
        canvas: '#F7F3EE',
        ok: '#2FAE6A',
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Noto Sans Arabic',
          'Tahoma',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
} satisfies Config
