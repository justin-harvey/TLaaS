import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Text"', '"Iowan Old Style"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        // Base ink & paper
        ink:        '#14243F',
        'ink-soft': '#2C3C58',
        paper:      '#F4EDDF',
        'paper-deep': '#ECE2CE',
        card:       '#FBF7EE',
        'card-raised': '#FFFDF8',
        // Civic Blue scale
        blue: {
          700: '#102A52',
          600: '#1B3D74',
          500: '#2D5BA8',
          300: '#7C9BC9',
          100: '#D7E1EF',
        },
        // Muted / structure
        muted:       '#756B5B',
        'muted-soft': '#9A8F7C',
        line:        '#DDD3BE',
        'line-strong': '#C6B99E',
        // Editorial tones
        cream:  '#E7D9B8',
        dusty:  '#BC8A86',
        gold:   '#C79A3E',
        sage:   '#8FA585',
        slate:  '#57646F',
        // Semantic
        anchored:  '#5F7E5A',
        pending:   '#B8862B',
        spike:     '#A8483A',
        'spike-bg': '#F0DCD5',
      },
      spacing: {
        '0.5': '2px',
        '1':   '4px',
        '2':   '8px',
        '3':   '12px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '8':   '32px',
        '10':  '40px',
        '12':  '48px',
        '16':  '64px',
      },
      borderRadius: {
        xs:  '3px',
        sm:  '5px',
        md:  '8px',
        lg:  '12px',
        pill: '999px',
      },
      boxShadow: {
        xs:  '0 1px 0 rgba(20,36,63,0.04)',
        sm:  '0 1px 2px rgba(20,36,63,0.06), 0 1px 1px rgba(20,36,63,0.04)',
        md:  '0 2px 6px rgba(20,36,63,0.08), 0 1px 2px rgba(20,36,63,0.05)',
        lg:  '0 12px 28px rgba(20,36,63,0.14), 0 2px 6px rgba(20,36,63,0.08)',
      },
      transitionTimingFunction: {
        'cc-out': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        mid:  '200ms',
        slow: '320ms',
      },
      width:  { sidebar: '248px' },
      height: { topbar:  '56px', row: '38px' },
    },
  },
  plugins: [],
};

export default config;
