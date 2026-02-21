// Playwright configuration for Financily e2e tests.
//
// Key decisions (see requirements TST-004 and TST-005):
//   - Only Chromium. No cross-browser testing needed for a local tool.
//   - webServer block auto-starts `npm run dev` before the test run,
//     so no manual server management is needed.
//   - reuseExistingServer: true locally (fast iteration), false in CI.
//   - All /api/* routes are mocked with page.route() — no running
//     FastAPI backend is required for any test.
//   - Test timeout: 15s per test, expect timeout: 5s.
//   - Traces are captured on first retry to aid debugging.
//
// Run tests: npm run test:e2e
// Run with UI: npm run test:e2e:ui

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',

  // TODO: set timeout, expect.timeout, fullyParallel, reporter

  use: {
    // TODO: set baseURL to http://localhost:5173
    // TODO: enable trace on first retry
  },

  projects: [
    // TODO: add chromium project using devices['Desktop Chrome']
  ],

  webServer: {
    // TODO: configure to run `npm run dev`, set url, reuseExistingServer, timeout
  },
})
