import { defineConfig } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'sharing', testMatch: 'sharingCi.pw.ts' },
    { name: 'mobile', testMatch: 'browser-smoke.spec.ts', grep: /@mobile-ci/ },
  ],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  use: {
    baseURL,
    headless: true,
    locale: 'zh-TW',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: {
      VITE_PUBLIC_DATA_PROVIDER: 'mock',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
