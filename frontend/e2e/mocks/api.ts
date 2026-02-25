import type { Page } from '@playwright/test'
import type { AssetsResponse, OptimizeResponse, SyncResponse } from '../../src/types/api'

export const mockAssets: AssetsResponse = {
  assets: [
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF', latest_date: '2026-02-19', rows: 2520 },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', latest_date: '2026-02-19', rows: 2520 },
    { ticker: 'TLT', name: 'iShares 20+ Year Treasury', latest_date: '2026-02-19', rows: 2520 },
    { ticker: 'GLD', name: 'SPDR Gold Shares', latest_date: '2026-02-19', rows: 2520 },
  ],
}

export const mockSyncSuccess: SyncResponse = {
  status: 'ok',
  tickers_synced: 4,
  rows_upserted: 120,
  latest_date: '2026-02-19',
}

export const mockOptimizeResult: OptimizeResponse = {
  run_id: 'test-run-001',
  feasible: true,
  optimal_portfolio: {
    weights: { SPY: 0.4, QQQ: 0.3, TLT: 0.2, GLD: 0.1 },
    expected_return_pretax: 0.142,
    expected_return_aftertax: 0.121,
    volatility: 0.148,
    sharpe_ratio: 1.23,
    max_drawdown_median: -0.18,
    max_drawdown_p95: -0.31,
    var_95: -0.22,
    cvar_95: -0.28,
  },
  risk_cost_table: [
    { target_return: 0.05, min_drawdown_p95: -0.08, volatility: 0.07, cvar_95: -0.1 },
    { target_return: 0.08, min_drawdown_p95: -0.12, volatility: 0.1, cvar_95: -0.14 },
    { target_return: 0.1, min_drawdown_p95: -0.15, volatility: 0.12, cvar_95: -0.18 },
    { target_return: 0.12, min_drawdown_p95: -0.18, volatility: 0.14, cvar_95: -0.21 },
    { target_return: 0.14, min_drawdown_p95: -0.21, volatility: 0.16, cvar_95: -0.24 },
    { target_return: 0.16, min_drawdown_p95: -0.24, volatility: 0.18, cvar_95: -0.27 },
    { target_return: 0.18, min_drawdown_p95: -0.27, volatility: 0.2, cvar_95: -0.3 },
    { target_return: 0.2, min_drawdown_p95: -0.3, volatility: 0.22, cvar_95: -0.33 },
    { target_return: 0.22, min_drawdown_p95: -0.33, volatility: 0.24, cvar_95: -0.37 },
    { target_return: 0.25, min_drawdown_p95: -0.38, volatility: 0.27, cvar_95: -0.42 },
    { target_return: 0.28, min_drawdown_p95: -0.43, volatility: 0.3, cvar_95: -0.47 },
    { target_return: 0.3, min_drawdown_p95: -0.47, volatility: 0.33, cvar_95: -0.52 },
    { target_return: 0.35, min_drawdown_p95: -0.55, volatility: 0.38, cvar_95: -0.6 },
    { target_return: 0.4, min_drawdown_p95: -0.62, volatility: 0.43, cvar_95: -0.68 },
    { target_return: 0.45, min_drawdown_p95: -0.69, volatility: 0.48, cvar_95: -0.76 },
    { target_return: 0.5, min_drawdown_p95: -0.76, volatility: 0.53, cvar_95: -0.84 },
  ],
  forecasts: {
    SPY: { mu: 0.082, sigma: 0.161 },
    QQQ: { mu: 0.094, sigma: 0.198 },
    TLT: { mu: 0.021, sigma: 0.142 },
    GLD: { mu: 0.038, sigma: 0.155 },
  },
}

type ErrorOverride = { status: number; body: object }

function isErrorOverride(x: unknown): x is ErrorOverride {
  return (
    x !== null &&
    typeof x === 'object' &&
    'status' in x &&
    typeof (x as ErrorOverride).status === 'number'
  )
}

export async function setupApiMocks(
  page: Page,
  overrides?: {
    assets?: AssetsResponse | ErrorOverride
    sync?: SyncResponse | ErrorOverride
    optimize?: OptimizeResponse | ErrorOverride
  },
): Promise<void> {
  const o = overrides ?? {}

  await page.route('**/api/assets', async (route) => {
    const override = o.assets
    if (isErrorOverride(override)) {
      await route.fulfill({
        status: override.status,
        contentType: 'application/json',
        body: JSON.stringify(override.body),
      })
    } else {
      await route.fulfill({ json: override ?? mockAssets })
    }
  })

  await page.route('**/api/sync', async (route) => {
    const override = o.sync
    if (isErrorOverride(override)) {
      await route.fulfill({
        status: override.status,
        contentType: 'application/json',
        body: JSON.stringify(override.body),
      })
    } else {
      await route.fulfill({ json: override ?? mockSyncSuccess })
    }
  })

  await page.route('**/api/optimize', async (route) => {
    const override = o.optimize
    if (isErrorOverride(override)) {
      await route.fulfill({
        status: override.status,
        contentType: 'application/json',
        body: JSON.stringify(override.body),
      })
    } else {
      await route.fulfill({ json: override ?? mockOptimizeResult })
    }
  })
}
