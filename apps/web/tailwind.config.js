const themeColor = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: themeColor('--color-bg'),
        panel: themeColor('--color-panel'),
        panelAlt: themeColor('--color-panel-alt'),
        line: themeColor('--color-line'),
        accent: themeColor('--color-accent'),
        arcadePink: themeColor('--color-arcade-pink'),
        signal: themeColor('--color-signal'),
        success: themeColor('--color-success'),
        fg: themeColor('--color-fg'),
      },
      boxShadow: {
        pixel: 'var(--shadow-pixel)',
      },
      fontFamily: {
        display: ['"Trebuchet MS"', '"Noto Sans TC"', 'sans-serif'],
        body: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
