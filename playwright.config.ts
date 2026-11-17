import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './web/tests',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.PHONEAPP_BROWSER_URL || 'http://127.0.0.1:8790',
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--disable-background-timer-throttling',
      ],
    },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: process.env.PHONEAPP_BROWSER_URL
    ? undefined
    : {
        command: 'npx tsx scripts/browser-test-server.ts',
        url: 'http://127.0.0.1:8790/health',
        timeout: 15_000,
        reuseExistingServer: false,
      },
});
