import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ['person-claim-isolation.spec.ts', 'homeLoadRecovery.pw.ts'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: { headless: true, locale: 'zh-TW', viewport: { width: 1440, height: 900 } },
});
