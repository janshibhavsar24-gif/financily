import { expect, test } from '@playwright/test'
import { mockMonitorResponse, mockWatchlist, setupApiMocks } from './mocks/api'

// Navigate to the Monitor tab before each test
async function goToMonitor(page: Parameters<typeof setupApiMocks>[0]) {
  await page.getByTestId('nav-monitor').click()
}

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
})

// ---------------------------------------------------------------------------
// 1. Monitor nav button visible
// ---------------------------------------------------------------------------
test('monitor nav button is visible', async ({ page }) => {
  await expect(page.getByTestId('nav-monitor')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Empty state when watchlist is empty
// ---------------------------------------------------------------------------
test('shows empty state when watchlist is empty', async ({ page }) => {
  // Default mock returns tickers: [] for watchlist
  await goToMonitor(page)
  await expect(page.getByText(/add tickers to your watchlist/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 3. Add ticker to watchlist → chip appears
// ---------------------------------------------------------------------------
test('add ticker to watchlist shows chip', async ({ page }) => {
  await goToMonitor(page)

  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SPY')
  const option = page.getByRole('option', { name: /SPY/i })
  await expect(option).toBeVisible()
  await option.dispatchEvent('mousedown')

  await expect(page.getByTestId('chip-SPY')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Remove ticker chip → removed
// ---------------------------------------------------------------------------
test('remove ticker chip removes it from watchlist', async ({ page }) => {
  // Start with SPY in watchlist
  await setupApiMocks(page, { watchlist: mockWatchlist })
  await goToMonitor(page)

  // Wait for chips to appear
  await expect(page.getByTestId('chip-SPY')).toBeVisible()

  // Remove SPY
  await page.getByTestId('chip-SPY').getByRole('button', { name: /remove SPY/i }).click()
  await expect(page.getByTestId('chip-SPY')).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. Watchlist persists across page load
// ---------------------------------------------------------------------------
test('watchlist tickers appear on load when persisted', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist })
  await goToMonitor(page)

  // Both saved tickers should render as chips
  await expect(page.getByTestId('chip-SPY')).toBeVisible()
  await expect(page.getByTestId('chip-AAPL')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 6. Heat map cells visible after data loads
// ---------------------------------------------------------------------------
test('heat map cells are visible after data loads', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  for (const ticker of mockMonitorResponse.stocks.map((s) => s.ticker)) {
    await expect(page.getByTestId(`heatmap-cell-${ticker}`)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// 7. Pulse table rows visible with correct data-testid
// ---------------------------------------------------------------------------
test('pulse table rows are visible with correct data-testid', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  for (const ticker of mockMonitorResponse.stocks.map((s) => s.ticker)) {
    await expect(page.getByTestId(`pulse-row-${ticker}`)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// 8. Drawdown bars visible
// ---------------------------------------------------------------------------
test('drawdown bars are visible', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  for (const ticker of mockMonitorResponse.stocks.map((s) => s.ticker)) {
    await expect(page.getByTestId(`drawdown-bar-${ticker}`)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// 9. Sparklines visible
// ---------------------------------------------------------------------------
test('sparklines are visible for each ticker', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  for (const ticker of mockMonitorResponse.stocks.map((s) => s.ticker)) {
    await expect(page.getByTestId(`sparkline-${ticker}`)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// 10. Correlation matrix cells visible
// ---------------------------------------------------------------------------
test('correlation matrix cells are visible', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  const tickers = mockMonitorResponse.correlation!.tickers
  for (const ta of tickers) {
    for (const tb of tickers) {
      await expect(page.getByTestId(`corr-cell-${ta}-${tb}`)).toBeVisible()
    }
  }
})

// ---------------------------------------------------------------------------
// 11. Sort by Day % column changes row order
// ---------------------------------------------------------------------------
test('sorting by Day % column reorders pulse table rows', async ({ page }) => {
  await setupApiMocks(page, { watchlist: mockWatchlist, monitor: mockMonitorResponse })
  await goToMonitor(page)

  // Rows before sort — get their order
  const rows = page.locator('[data-testid^="pulse-row-"]')
  await expect(rows.first()).toBeVisible()

  const firstTickerBefore = await rows.first().getAttribute('data-testid')

  // Click "Day %" header to sort descending (highest day% first)
  await page.getByRole('columnheader', { name: /day %/i }).click()

  // SPY has day_pct: +1.23%, AAPL has day_pct: -0.87%
  // After descending sort, SPY should be first
  const firstTickerAfter = await rows.first().getAttribute('data-testid')

  // SPY has higher day_pct, so after descending sort it should be first
  expect(firstTickerAfter).toBe('pulse-row-SPY')

  // Click again for ascending sort — AAPL (most negative) should be first
  await page.getByRole('columnheader', { name: /day %/i }).click()
  const firstTickerAsc = await rows.first().getAttribute('data-testid')
  expect(firstTickerAsc).toBe('pulse-row-AAPL')
})
