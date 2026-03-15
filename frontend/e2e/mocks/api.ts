import type { Page } from '@playwright/test'
import type {
  AssetsResponse,
  LotInfo,
  MonitorResponse,
  OptimizeResponse,
  PortfolioResponse,
  SearchResponse,
  SyncResponse,
  WatchlistInfo,
  WatchlistListResponse,
  WatchlistResponse,
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

export const mockWatchlist: WatchlistResponse = {
  tickers: ['SPY', 'AAPL'],
}

function makeSpark(n = 30): Array<{ date: string; ret: number }> {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    ret: (Math.random() - 0.48) * 0.02,
  }))
}

export const mockMonitorResponse: MonitorResponse = {
  stocks: [
    {
      ticker: 'SPY',
      latest_date: '2026-02-19',
      price: 512.34,
      day_pct: 0.0123,
      week_pct: 0.0215,
      month_pct: 0.038,
      three_month_pct: 0.072,
      ann_volatility: 0.162,
      drawdown_from_high: -0.034,
      spark: makeSpark(),
    },
    {
      ticker: 'AAPL',
      latest_date: '2026-02-19',
      price: 198.76,
      day_pct: -0.0087,
      week_pct: -0.0145,
      month_pct: 0.021,
      three_month_pct: 0.041,
      ann_volatility: 0.198,
      drawdown_from_high: -0.078,
      spark: makeSpark(),
    },
  ],
  correlation: {
    tickers: ['SPY', 'AAPL'],
    values: [
      [1.0, 0.72],
      [0.72, 1.0],
    ],
  },
}

// ---------------------------------------------------------------------------
// Named watchlist + portfolio mock data
// ---------------------------------------------------------------------------

export const mockWatchlistList: WatchlistListResponse = {
  watchlists: [
    { id: 'wl-1', name: 'My Portfolio', holding_count: 3, created_at: '2024-01-01T00:00:00' },
    { id: 'wl-2', name: 'Tech Picks', holding_count: 1, created_at: '2024-01-02T00:00:00' },
  ],
}

export const mockHoldings: LotInfo[] = [
  { lot_id: 'lot-1', ticker: 'SPY', amount: 5000, purchase_date: '2023-11-01', added_at: '2024-01-01T00:00:00' },
  { lot_id: 'lot-2', ticker: 'AAPL', amount: 1000, purchase_date: '2024-01-15', added_at: '2024-01-01T01:00:00' },
  { lot_id: 'lot-3', ticker: 'AAPL', amount: 500, purchase_date: '2024-06-01', added_at: '2024-06-01T00:00:00' },
]

export const mockPortfolio: PortfolioResponse = {
  watchlist_id: 'wl-1',
  watchlist_name: 'My Portfolio',
  summary: {
    total_invested: 6500,
    total_current_value: 7520,
    total_pl_dollars: 1020,
    total_pl_pct: 0.1569,
    spy_equivalent_value: 7551,
    spy_return_pct: 0.1617,
    as_of_date: '2026-02-19',
  },
  holdings: [
    {
      ticker: 'SPY',
      lots: [
        {
          lot_id: 'lot-1',
          ticker: 'SPY',
          amount: 5000,
          purchase_date: '2023-11-01',
          purchase_price: 430.0,
          current_price: 512.34,
          current_value: 5900,
          pl_dollars: 900,
          pl_pct: 0.18,
          days_held: 840,
        },
      ],
      total_amount: 5000,
      total_current_value: 5900,
      total_pl_dollars: 900,
      avg_pl_pct: 0.18,
      allocation_pct: 0.785,
    },
    {
      ticker: 'AAPL',
      lots: [
        {
          lot_id: 'lot-2',
          ticker: 'AAPL',
          amount: 1000,
          purchase_date: '2024-01-15',
          purchase_price: 185.0,
          current_price: 198.76,
          current_value: 1100,
          pl_dollars: 100,
          pl_pct: 0.1,
          days_held: 395,
        },
        {
          lot_id: 'lot-3',
          ticker: 'AAPL',
          amount: 500,
          purchase_date: '2024-06-01',
          purchase_price: 192.0,
          current_price: 198.76,
          current_value: 520,
          pl_dollars: 20,
          pl_pct: 0.04,
          days_held: 258,
        },
      ],
      total_amount: 1500,
      total_current_value: 1620,
      total_pl_dollars: 120,
      avg_pl_pct: 0.08,
      allocation_pct: 0.215,
    },
  ],
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
  watchlist?: WatchlistResponse | ErrorOverride
  monitor?: MonitorResponse | ErrorOverride
  // Named watchlists
  watchlists?: WatchlistListResponse | ErrorOverride
  portfolio?: PortfolioResponse | ErrorOverride
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

  await page.route('**/api/watchlist', async (route) => {
    const method = route.request().method()
    const override = o.watchlist
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
      return
    }
    if (method === 'POST') {
      // Echo back the tickers that were saved
      let body: WatchlistResponse = override ?? { tickers: [] }
      try {
        const req = JSON.parse(route.request().postData() ?? '{}') as { tickers?: string[] }
        body = { tickers: req.tickers ?? [] }
      } catch {
        // use default
      }
      await route.fulfill({ json: body })
    } else {
      await route.fulfill({ json: override ?? { tickers: [] } })
    }
  })

  await page.route('**/api/monitor*', async (route) => {
    const override = o.monitor
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
    } else {
      await route.fulfill({ json: override ?? mockMonitorResponse })
    }
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

  // Named watchlists list + create
  await page.route('**/api/watchlists', async (route) => {
    const method = route.request().method()
    const override = o.watchlists
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
      return
    }
    if (method === 'POST') {
      // Create a new watchlist — echo back a new WatchlistInfo
      let name = 'New Watchlist'
      try {
        const req = JSON.parse(route.request().postData() ?? '{}') as { name?: string }
        name = req.name ?? name
      } catch { /* ignore */ }
      const newWl: WatchlistInfo = {
        id: `wl-new-${Date.now()}`,
        name,
        holding_count: 0,
        created_at: new Date().toISOString(),
      }
      await route.fulfill({ status: 201, json: newWl })
    } else {
      await route.fulfill({ json: override ?? mockWatchlistList })
    }
  })

  // Watchlist by ID — rename / delete
  await page.route('**/api/watchlists/*', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    // Skip sub-resource routes (holdings, portfolio) — handled separately
    if (url.includes('/holdings') || url.includes('/portfolio')) {
      await route.continue()
      return
    }

    if (method === 'PATCH') {
      // Rename — return updated WatchlistInfo
      const segments = url.split('/')
      const id = segments[segments.length - 1]
      let name = 'Renamed'
      try {
        const req = JSON.parse(route.request().postData() ?? '{}') as { name?: string }
        name = req.name ?? name
      } catch { /* ignore */ }
      // Find in mockWatchlistList or use generic
      const existing = mockWatchlistList.watchlists.find((w) => w.id === id)
      const updated: WatchlistInfo = { ...(existing ?? { id, holding_count: 0, created_at: '' }), name }
      await route.fulfill({ json: updated })
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
    } else {
      // GET single watchlist — not used by frontend but handle gracefully
      await route.fulfill({ status: 404, json: { detail: 'Not found' } })
    }
  })

  // Holdings — GET list / POST add lot: /api/watchlists/:id/holdings
  await page.route('**/api/watchlists/*/holdings', async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      let ticker = 'UNKNOWN'
      let amount = 0
      let purchase_date = '2024-01-01'
      try {
        const req = JSON.parse(route.request().postData() ?? '{}') as { ticker?: string; amount?: number; purchase_date?: string }
        ticker = req.ticker?.toUpperCase() ?? ticker
        amount = req.amount ?? amount
        purchase_date = req.purchase_date ?? purchase_date
      } catch { /* ignore */ }
      const newLot: LotInfo = {
        lot_id: `lot-new-${Date.now()}`,
        ticker,
        amount,
        purchase_date,
        added_at: new Date().toISOString(),
      }
      await route.fulfill({ status: 201, json: newLot })
    } else {
      await route.fulfill({
        json: {
          watchlist_id: 'wl-1',
          watchlist_name: 'My Portfolio',
          holdings: mockHoldings,
        },
      })
    }
  })

  // Delete specific lot: DELETE /api/watchlists/:id/holdings/:lotId
  // Added last so it has higher priority than the holdings base route
  await page.route('**/api/watchlists/*/holdings/*', async (route) => {
    await route.fulfill({ status: 204, body: '' })
  })

  // Portfolio P&L — added last so it overrides watchlist/* if glob is greedy
  await page.route('**/api/watchlists/*/portfolio', async (route) => {
    const override = o.portfolio
    if (isErrorOverride(override)) {
      await route.fulfill({ status: override.status, contentType: 'application/json', body: JSON.stringify(override.body) })
      return
    }
    await route.fulfill({ json: override ?? mockPortfolio })
  })
}
