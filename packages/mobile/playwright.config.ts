import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.MOBILE_E2E_BASE_URL ?? 'http://localhost:4174';
const shouldStartServer = !process.env.MOBILE_E2E_BASE_URL;

/**
 * Playwright configuration for RayHealth mobile smoke tests.
 *
 * This exercises the Expo web export with a mobile browser profile. Native
 * device flows still need a later Detox/Appium layer once simulator fixtures
 * and location permissions are formalized.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    ...devices['Pixel 5'],
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: shouldStartServer
    ? {
        command: 'npx expo export --clear && npx serve -s dist -p 4174 --no-port-switching',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
