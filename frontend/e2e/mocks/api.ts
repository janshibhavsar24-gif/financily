// Mock API response factories and the setupApiMocks helper.
//
// Purpose (see requirement TST-006):
//   Every Playwright test imports setupApiMocks() and calls it in
//   beforeEach. This installs page.route() intercepts for all /api/*
//   endpoints so NO running FastAPI backend is needed for any test.
//
// Usage:
//   import { setupApiMocks, mockOptimizeResult } from './mocks/api'
//
//   test('my test', async ({ page }) => {
//     await setupApiMocks(page)                    // happy-path defaults
//     await setupApiMocks(page, {                  // with override
//       optimize: { status: 422, body: { ... } }
//     })
//   })
//
// Override rules (see TST-006):
//   - Each key in `overrides` replaces only that endpoint's response.
//   - Overrides can be a full response object (same type as the default)
//     OR an error shape { status: number, body: object } for non-2xx cases.
//   - Endpoints not in `overrides` always return their default mock.

// TODO: import type { Page } from '@playwright/test'
// TODO: import type {
//   AssetsResponse, SyncResponse, OptimizeResponse
// } from '../../src/types/api'

// ---------------------------------------------------------------------------
// Default mock responses — represent a healthy happy-path state
// ---------------------------------------------------------------------------

// TODO: export const mockAssets: AssetsResponse = {
//   assets: [
//     { ticker: 'SPY', name: 'SPDR S&P 500 ETF',        latest_date: '2026-02-19', rows: 2520 },
//     { ticker: 'QQQ', name: 'Invesco QQQ Trust',        latest_date: '2026-02-19', rows: 2520 },
//     { ticker: 'TLT', name: 'iShares 20+ Year Treasury',latest_date: '2026-02-19', rows: 2520 },
//     { ticker: 'GLD', name: 'SPDR Gold Shares',         latest_date: '2026-02-19', rows: 2520 },
//   ],
// }

// TODO: export const mockSyncSuccess: SyncResponse = {
//   status: 'ok', tickers_synced: 4, rows_upserted: 120, latest_date: '2026-02-19',
// }

// TODO: export const mockOptimizeResult: OptimizeResponse = { ... }
//   Fill in with realistic values matching the specs.md example response.
//   Weights must sum to 1. max_drawdown_p95 must be negative.

// ---------------------------------------------------------------------------
// setupApiMocks — installs intercepts for all /api/* routes
// ---------------------------------------------------------------------------

// TODO: type ErrorOverride = { status: number; body: object }

// TODO: export async function setupApiMocks(
//   page: Page,
//   overrides?: {
//     assets?:   AssetsResponse | ErrorOverride
//     sync?:     SyncResponse   | ErrorOverride
//     optimize?: OptimizeResponse | ErrorOverride
//   }
// ): Promise<void>
//
// For each endpoint (/api/assets, /api/sync, /api/optimize):
//   - If override is provided and has a `status` key → route.fulfill({ status, json: body })
//   - If override is provided without `status` → route.fulfill({ json: override })
//   - Otherwise → route.fulfill({ json: defaultMock })
