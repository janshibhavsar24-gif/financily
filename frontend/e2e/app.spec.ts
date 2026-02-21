// app.spec.ts — full user journey tests (see requirements TST-007)
//
// These 6 tests cover the primary user flow from landing to results.
// All API calls are mocked via setupApiMocks — no backend required (TST-005).
//
// Tests in this file:
//
//   1. 'empty state shown on load'
//      Navigate to /, assert "Select assets and run the optimizer" is visible.
//
//   2. 'asset selector populates from /api/assets'
//      Type "SP" in the search box, assert "SPDR S&P 500 ETF" appears
//      in the dropdown.
//
//   3. 'can add and remove an asset chip'
//      Type "SPY", click the option, assert chip-SPY is visible.
//      Click the chip remove button, assert chip-SPY is gone.
//
//   4. 'sync button shows success message'
//      Add SPY, click "Sync Data", assert "Synced — 120 rows" message appears.
//
//   5. 'happy path: full optimize run renders all result panels'
//      Add SPY/QQQ/TLT/GLD, click "Run Optimizer".
//      Assert weight-bar-SPY visible, key metric values visible,
//      "Risk cost of each return target" caption visible,
//      "Per-asset return forecasts" caption visible.
//
//   6. 'run optimizer button is disabled while loading'
//      Slow down /api/optimize with a 500ms delay.
//      Click "Run Optimizer", immediately assert button is disabled.

// TODO: import { test, expect } from '@playwright/test'
// TODO: import { setupApiMocks, mockOptimizeResult } from './mocks/api'

// TODO: test.beforeEach(async ({ page }) => {
//   await setupApiMocks(page)
// })

// TODO: test('empty state shown on load', ...)
// TODO: test('asset selector populates from /api/assets', ...)
// TODO: test('can add and remove an asset chip', ...)
// TODO: test('sync button shows success message', ...)
// TODO: test('happy path: full optimize run renders all result panels', ...)
// TODO: test('run optimizer button is disabled while loading', ...)
