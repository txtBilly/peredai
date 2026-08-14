import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     '#14140F',   // dark text / (legacy) dark bg
        paper:   '#FAFAF7',   // Neo-Classified light background
        cobalt:  '#1B4DE4',   // signature link + primary accent
        cobalt2: '#5B2BFF',   // gradient end (cobalt → violet)
        leaf:    '#0A9D57',   // "no fee" / verified green pin
        gold:    '#C9A227',   // legacy accent (still used on unconverted screens)
        sage:    '#5B6B5A',   // legacy trust green
        muted:   '#8A867A',
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Headings use system Helvetica (real Helvetica Neue on macOS, Arial elsewhere).
        display: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
        logo:    ['var(--font-logo)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-cobalt': 'linear-gradient(120deg, #1B4DE4, #5B2BFF)',
      },
    },
  },
  plugins: [],
};
export default config;
