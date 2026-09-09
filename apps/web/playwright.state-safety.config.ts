import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['uiStateSafety.pw.ts', 'publicFlowSafety.pw.ts', 'publicPageFailures.pw.ts', 'pwaUpdate.pw.ts', 'metadataRecovery.pw.ts', 'birthDateDisplay.pw.ts'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: { headless: true, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
});
