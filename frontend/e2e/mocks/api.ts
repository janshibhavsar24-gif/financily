import type { Page } from '@playwright/test'
import type {
  AssetsResponse,
  OptimizeResponse,
  SearchResponse,
  SyncResponse,
} from '../../src/types/api'

// ---------------------------------------------------------------------------
// Static mock data
// ---------------------------------------------------------------------------

export const mockAssets: AssetsResponse = {
  assets: [
    {
      ticker: 'SPY',
      name: 'SPDR S&P 500 ETF',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.97,
      asset_type: 'etf',
      sector: null,
    },
    {
      ticker: 'QQQ',
      name: 'Invesco QQQ Trust',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.95,
      asset_type: 'etf',
      sector: null,
    },
    {
      ticker: 'TLT',
      name: 'iShares 20+ Year Treasury',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.94,
      asset_type: 'etf',
      sector: null,
    },
    {
      ticker: 'GLD',
      name: 'SPDR Gold Shares',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.93,
      asset_type: 'etf',
      sector: null,
    },
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.98,
      asset_type: 'equity',
      sector: 'Technology',
    },
    {
      ticker: 'MSFT',
      name: 'Microsoft Corporation',
      latest_date: '2026-02-19',
      rows: 2520,
      quality_score: 0.97,
      asset_type: 'equity',
      sector: 'Technology',
    },
  ],
}

export const mockSearchResults: SearchResponse = {
  results: mockAssets.assets.map((a) => ({
    symbol: a.ticker,
    name: a.name,
    asset_type: a.asset_type,
    sector: a.sector,
    country: 'United States',
    exchange: 'NMS',
    is_synced: true,
    quality_score: a.quality_score,
  })),
  total: mockAssets.assets.length,
}

export const mockSyncSuccess: SyncResponse = {
  status: 'ok',
  tickers_synced: 4,
  rows_upserted: 120,
  latest_date: '2026-02-19',
  unknown_tickers: [],
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
  warnings: [],
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

/**
 * Build a complete SSE response body from an array of event payloads.
 * All events are delivered in a single response (Playwright fulfills responses
 * atomically). The client-side SSE parser handles multi-event bodies correctly.
 */
export function sseBody(events: Array<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

export const MOCK_DD_REPORT_AAPL = sseBody([
  { type: 'token', content: '# Apple Inc. (AAPL)\n\n' },
  { type: 'token', content: '## 1. Business Quality\n\n' },
  { type: 'token', content: 'Apple designs and markets consumer electronics, software, and services.\n\n' },
  { type: 'token', content: '## 2. Financial Strength\n\n**Total Debt:** $108B  **Cash:** $67B\n\n' },
  { type: 'token', content: '## 3. Profitability\n\n**Gross Margin:** 46%  **Net Margin:** 26%\n\n' },
  { type: 'token', content: '## 4. Growth\n\nRevenue CAGR (5Y): +9%\n\n' },
  { type: 'token', content: '## 5. Valuation\n\n**P/E:** 31x  **PEG:** 2.8\n\n' },
  { type: 'token', content: '## 6. Risk\n\n**Beta:** 1.24\n\n' },
  { type: 'token', content: '## 7. Competitive Position\n\nDominant brand moat, high switching costs.\n\n' },
  { type: 'token', content: '## 8. Catalysts\n\nNext earnings: May 2026.\n\n' },
  { type: 'token', content: '| Category | Score |\n|---|---|\n| Financial Strength | 4 |\n\n' },
  { type: 'token', content: '**30% revenue drop:** AAPL would survive — $67B cash cushion.\n' },
  { type: 'done', input_tokens: 1540, output_tokens: 980 },
])

export const MOCK_DD_REPORT_MSFT = sseBody([
  { type: 'token', content: '# Microsoft Corporation (MSFT)\n\n' },
  { type: 'token', content: '## 1. Business Quality\n\nMicrosoft provides cloud, productivity, and gaming products.\n\n' },
  { type: 'token', content: '**30% revenue drop:** MSFT would survive with strong Azure margins.\n' },
  { type: 'done', input_tokens: 1400, output_tokens: 800 },
])

export const MOCK_DD_CHAT_RESPONSE = sseBody([
  { type: 'token', content: "AAPL's D/E ratio is approximately 1.8x, " },
  { type: 'token', content: 'which is higher than MSFT at 0.4x but manageable given its free cash flow.' },
  { type: 'done' },
])

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

type ErrorOverride = { status: number; body: object }

function isErrorOverride(x: unknown): x is ErrorOverride {
  return (
    x !== null &&
    typeof x === 'object' &&
    'status' in x &&
    typeof (x as ErrorOverride).status === 'number'
  )
}

export type DdReportOverride =
  | { body: string }              // custom SSE body string
  | { status: number; body: object } // HTTP error

export interface SetupApiMocksOptions {
  assets?: AssetsResponse | ErrorOverride
  sync?: SyncResponse | ErrorOverride
  optimize?: OptimizeResponse | ErrorOverride
  search?: SearchResponse | ErrorOverride
  ddReport?: DdReportOverride | Record<string, string> // ticker → SSE body map
  ddChat?: { body: string } | ErrorOverride
}

export async function setupApiMocks(
  page: Page,
  overrides?: SetupApiMocksOptions,
): Promise<void> {
  const o = overrides ?? {}

  await page.route('**/api/assets', async (route) => {
    const override = o.assets
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
    } else {
      await route.fulfill({ json: override ?? mockAssets })
    }
  })

  await page.route('**/api/search*', async (route) => {
    const override = o.search
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
    } else if (override && !isErrorOverride(override)) {
      await route.fulfill({ json: override })
    } else {
      // Filter mockSearchResults by the q param for realistic behaviour
      const url = new URL(route.request().url())
      const q = url.searchParams.get('q') ?? ''
      const filtered = q
        ? mockSearchResults.results.filter(
            (r) =>
              r.symbol.toLowerCase().includes(q.toLowerCase()) ||
              r.name.toLowerCase().includes(q.toLowerCase()),
          )
        : mockSearchResults.results
      await route.fulfill({ json: { results: filtered, total: filtered.length } })
    }
  })

  await page.route('**/api/sync', async (route) => {
    const override = o.sync
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
    } else {
      await route.fulfill({ json: override ?? mockSyncSuccess })
    }
  })

  await page.route('**/api/optimize', async (route) => {
    const override = o.optimize
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
    } else {
      await route.fulfill({ json: override ?? mockOptimizeResult })
    }
  })

  // DD report — per-ticker or global
  await page.route('**/api/dd/report', async (route) => {
    const override = o.ddReport
    if (override && isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
      return
    }
    // Determine which ticker was requested
    let body: string = MOCK_DD_REPORT_AAPL
    try {
      const req = JSON.parse(route.request().postData() ?? '{}') as { ticker?: string }
      const ticker = req.ticker?.toUpperCase() ?? ''
      if (override && typeof override === 'object' && ticker in override) {
        body = (override as Record<string, string>)[ticker]
      } else if (override && 'body' in override && typeof override.body === 'string') {
        body = override.body
      } else if (ticker === 'MSFT') {
        body = MOCK_DD_REPORT_MSFT
      }
    } catch {
      // use default
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    })
  })

  // DD chat
  await page.route('**/api/dd/chat', async (route) => {
    const override = o.ddChat
    if (override && isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
      return
    }
    const chatBody = override && 'body' in override ? override.body : MOCK_DD_CHAT_RESPONSE
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: chatBody,
    })
  })
}
