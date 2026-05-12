export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090C17',
        panel: '#12182B',
        panelAlt: '#1A2340',
        line: '#2C3E70',
        accent: '#72E8FF',
        arcadePink: '#FF4FD8',
        signal: '#F4D35E',
        success: '#3DDC97',
      },
      boxShadow: {
        pixel: '0 0 0 2px rgba(114, 232, 255, 0.25), 0 0 0 6px rgba(255, 79, 216, 0.08)',
      },
      fontFamily: {
        display: ['"Trebuchet MS"', '"Noto Sans TC"', 'sans-serif'],
        body: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
