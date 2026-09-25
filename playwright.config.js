import { existsSync } from 'node:fs';
import { defineConfig, devices, chromium } from '@playwright/test';

// Use Playwright's own Chromium when it is installed (CI runs
// `npx playwright install --with-deps chromium`). Sandboxed dev containers ship a
// Chromium of another revision under /opt/pw-browsers instead; fall back to it.
function chromiumPath() {
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // executablePath() throws when the expected revision isn't registered.
  }
  return existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
}
const executablePath = chromiumPath();

const PORT = 4173;

// ToolDeck is an iPhone app. WebKit isn't available in every environment this
// runs in, so the project takes the iPhone 15 viewport, DPR, touch and mobile
// user agent but runs them in Chromium. Safari-only behaviour (real momentum
// scrolling, AudioContext quirks) is not covered here.
const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 15'];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}/ToolDeck/`,
    trace: 'retain-on-failure',
    // Tests run against the built app; a service worker would serve cached
    // builds and intercept requests. Only pwa.spec.js turns this back on.
    serviceWorkers: 'block',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'iphone-chromium',
      use: {
        ...iphone,
        browserName: 'chromium',
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/ToolDeck/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
