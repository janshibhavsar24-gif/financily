// components.spec.ts — error states and component edge cases (see TST-008)
//
// These 6 tests verify that individual components handle errors and edge
// cases correctly. Each test overrides one API endpoint via setupApiMocks.
// All tests run without a backend (TST-005).
//
// Tests in this file:
//
//   1. 'shows infeasibility error when target return too high'
//      Override /api/optimize → 422 { error: 'infeasible', max_achievable: 0.14 }
//      Click "Run Optimizer", assert error message contains "14%" and
//      text like "not achievable" is visible.
//
//   2. 'shows sync error message on backend failure'
//      Override /api/sync → 502 { detail: 'Yahoo Finance unavailable' }
//      Click "Sync Data", assert "Yahoo Finance unavailable" in red is visible.
//
//   3. 'shows "no data — sync first" when assets list is empty'
//      Override /api/assets → { assets: [] }
//      Click the search input, assert "No data — sync first" appears
//      in the dropdown.
//
//   4. 'RiskCostTable highlights row matching target return'
//      Default target return is 20%. Run optimizer.
//      Assert data-testid="risk-row-0.20" has a Tailwind ring class applied.
//
//   5. 'MetricsCard formats negative drawdown with en-dash not hyphen'
//      Run optimizer (max_drawdown_p95 = -0.31 in mock).
//      Assert data-testid="metric-max_drawdown_p95" has text "−31%"
//      (U+2212 en-dash, not hyphen-minus U+002D).
//
//   6. 'ParamForm horizon selector wires through to request body'
//      Click the "5" horizon button.
//      Intercept /api/optimize, run optimizer, inspect the POST body.
//      Assert JSON.parse(body).horizon_years === 5.

// TODO: import { test, expect } from '@playwright/test'
// TODO: import { setupApiMocks, mockOptimizeResult } from './mocks/api'

// TODO: test('shows infeasibility error when target return too high', ...)
// TODO: test('shows sync error message on backend failure', ...)
// TODO: test('shows "no data — sync first" when assets list is empty', ...)
// TODO: test('RiskCostTable highlights row matching target return', ...)
// TODO: test('MetricsCard formats negative drawdown with en-dash not hyphen', ...)
// TODO: test('ParamForm horizon selector wires through to request body', ...)
