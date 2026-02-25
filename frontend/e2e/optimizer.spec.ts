import { expect, test } from '@playwright/test'
import { mockOptimizeResult, setupApiMocks } from './mocks/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function addTickers(page: import('@playwright/test').Page, tickers: string[]) {
  const input = page.getByRole('textbox', { name: /search assets/i })
  for (const ticker of tickers) {
    await input.fill(ticker)
    const option = page.getByRole('option', { name: new RegExp(ticker, 'i') })
    await expect(option).toBeVisible()
    await option.dispatchEvent('mousedown')
    await expect(page.getByTestId(`chip-${ticker}`)).toBeVisible()
  }
}

/** Add tickers, click Run Optimizer, and wait for results to be visible. */
async function runOptimizer(
  page: import('@playwright/test').Page,
  tickers: string[] = ['SPY', 'QQQ'],
) {
  await addTickers(page, tickers)
  await page.getByRole('button', { name: /run optimizer/i }).click()
  // SPY always present in the mock response – use as the synchronisation point
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()
}

/**
 * Register a spy on /api/optimize that captures the request body and still
 * fulfils with the standard mock result so result panels appear normally.
 * Returns a promise that resolves to the parsed body once the request fires.
 */
function captureOptimizeBody(
  page: import('@playwright/test').Page,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    page.route('**/api/optimize', async (route) => {
      const raw = route.request().postData() ?? '{}'
      resolve(JSON.parse(raw) as Record<string, unknown>)
      await route.fulfill({ json: mockOptimizeResult })
    })
  })
}

// ─── setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REQUEST BODY — verify every optimizer param is wired up correctly
// ═══════════════════════════════════════════════════════════════════════════════

test('sends correct default params on first run', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.tickers).toEqual(['SPY', 'QQQ'])
  expect(body.target_return).toBe(0.12)
  expect(body.horizon_years).toBe(3)
  expect(body.max_weight).toBe(0.4)
  expect(body.tax_rate_lt).toBe(0.15)
  expect(body.tax_rate_st).toBe(0.37)
  expect(body.n_simulations).toBe(5000)
})

test('target_return slider wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  // First range input is Target Return (min 5, max 60)
  await page.locator('input[type="range"]').first().fill('30')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.target_return).toBe(0.3)
})

test('max_weight slider wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  // Second range input is Max Position (min 10, max 100, step 5)
  await page.locator('input[type="range"]').nth(1).fill('25')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.max_weight).toBe(0.25)
})

test('LTCG tax rate input wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  // Label "LTCG Rate (%)" is adjacent sibling of the number input
  await page.locator('label:has-text("LTCG Rate (%)") + input[type="number"]').fill('20')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.tax_rate_lt).toBe(0.2)
})

test('STCG tax rate input wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await page.locator('label:has-text("STCG Rate (%)") + input[type="number"]').fill('40')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.tax_rate_st).toBe(0.4)
})

test('2Y horizon button wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await page.getByRole('button', { name: '2Y' }).click()
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.horizon_years).toBe(2)
})

test('simulation quality Fast (1 000) wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await page.locator('label:has-text("Simulation Quality") + select').selectOption('1000')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.n_simulations).toBe(1000)
})

test('simulation quality Precise (10 000) wires to request body', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await page.locator('label:has-text("Simulation Quality") + select').selectOption('10000')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.n_simulations).toBe(10000)
})

test('all selected tickers are sent in correct order', async ({ page }) => {
  const bodyPromise = captureOptimizeBody(page)
  await addTickers(page, ['TLT', 'SPY', 'GLD'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  const body = await bodyPromise

  expect(body.tickers).toEqual(['TLT', 'SPY', 'GLD'])
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RESULT RENDERING — verify every panel displays the correct values
// ═══════════════════════════════════════════════════════════════════════════════

test('all portfolio metric values display correctly', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  // Positive returns use + sign; negative risk metrics use − (U+2212, not hyphen)
  await expect(page.getByTestId('metric-expected_return_pretax')).toHaveText('+14.2%')
  await expect(page.getByTestId('metric-expected_return_aftertax')).toHaveText('+12.1%')
  await expect(page.getByTestId('metric-volatility')).toHaveText('14.8%')
  await expect(page.getByTestId('metric-sharpe_ratio')).toHaveText('1.23')
  await expect(page.getByTestId('metric-max_drawdown_median')).toHaveText('\u221218.0%')
  await expect(page.getByTestId('metric-max_drawdown_p95')).toHaveText('\u221231.0%')
  await expect(page.getByTestId('metric-cvar_95')).toHaveText('\u221228.0%')
})

test('weight bars display correct percentage widths', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  // Mock weights: SPY 40%, QQQ 30%, TLT 20%, GLD 10%
  expect(await page.getByTestId('weight-bar-SPY').getAttribute('style')).toContain('width: 40%')
  expect(await page.getByTestId('weight-bar-QQQ').getAttribute('style')).toContain('width: 30%')
  expect(await page.getByTestId('weight-bar-TLT').getAttribute('style')).toContain('width: 20%')
  expect(await page.getByTestId('weight-bar-GLD').getAttribute('style')).toContain('width: 10%')
})

test('weight bars are sorted by weight descending', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  const bars = page.locator('[data-testid^="weight-bar-"]')
  await expect(bars).toHaveCount(4)
  // Heaviest first: SPY(40) > QQQ(30) > TLT(20) > GLD(10)
  await expect(bars.nth(0)).toHaveAttribute('data-testid', 'weight-bar-SPY')
  await expect(bars.nth(1)).toHaveAttribute('data-testid', 'weight-bar-QQQ')
  await expect(bars.nth(2)).toHaveAttribute('data-testid', 'weight-bar-TLT')
  await expect(bars.nth(3)).toHaveAttribute('data-testid', 'weight-bar-GLD')
})

test('forecast table shows correct mu and sigma values per ticker', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  const forecastTable = page.locator('table', {
    has: page.getByText('Per-asset return forecasts'),
  })

  const spyRow = forecastTable.getByRole('row', { name: /SPY/i })
  await expect(spyRow).toContainText('8.2%') // mu  0.082
  await expect(spyRow).toContainText('16.1%') // sigma 0.161

  const qqqRow = forecastTable.getByRole('row', { name: /QQQ/i })
  await expect(qqqRow).toContainText('9.4%')
  await expect(qqqRow).toContainText('19.8%')

  const tltRow = forecastTable.getByRole('row', { name: /TLT/i })
  await expect(tltRow).toContainText('2.1%')
  await expect(tltRow).toContainText('14.2%')

  const gldRow = forecastTable.getByRole('row', { name: /GLD/i })
  await expect(gldRow).toContainText('3.8%')
  await expect(gldRow).toContainText('15.5%')
})

test('forecast table renders tickers in alphabetical order', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  const forecastTable = page.locator('table', {
    has: page.getByText('Per-asset return forecasts'),
  })
  const rows = forecastTable.locator('tbody tr')

  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('GLD') // G < Q < S < T
  await expect(rows.nth(1)).toContainText('QQQ')
  await expect(rows.nth(2)).toContainText('SPY')
  await expect(rows.nth(3)).toContainText('TLT')
})

test('risk cost table renders all frontier rows with correct boundary values', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  const riskTable = page.locator('table', {
    has: page.getByText('Risk cost of each return target'),
  })
  const rows = riskTable.locator('tbody tr')

  // Mock provides 16 rows from 5% to 50%
  await expect(rows).toHaveCount(16)
  await expect(rows.nth(0)).toContainText('5.0%')
  await expect(rows.nth(15)).toContainText('50.0%')
})

test('risk cost table shows correct min-drawdown and CVaR values', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ', 'TLT', 'GLD'])

  const riskTable = page.locator('table', {
    has: page.getByText('Risk cost of each return target'),
  })
  // First row: target 5%, min_drawdown_p95 -0.08 → −8.0%, cvar_95 -0.10 → −10.0%
  const firstRow = riskTable.locator('tbody tr').first()
  await expect(firstRow).toContainText('\u22128.0%')
  await expect(firstRow).toContainText('\u221210.0%')
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UI LIFECYCLE — button state, loading, results clearing, error handling
// ═══════════════════════════════════════════════════════════════════════════════

test('run optimizer button is disabled with 0 tickers selected', async ({ page }) => {
  await expect(page.getByRole('button', { name: /run optimizer/i })).toBeDisabled()
  await expect(page.getByText(/select at least 2 assets/i)).toBeVisible()
})

test('run optimizer button is disabled with exactly 1 ticker selected', async ({ page }) => {
  await addTickers(page, ['SPY'])
  await expect(page.getByRole('button', { name: /run optimizer/i })).toBeDisabled()
  await expect(page.getByText(/select at least 1 more asset/i)).toBeVisible()
})

test('run optimizer button is enabled with exactly 2 tickers selected', async ({ page }) => {
  await addTickers(page, ['SPY', 'QQQ'])
  await expect(page.getByRole('button', { name: /run optimizer/i })).toBeEnabled()
})

test('loading spinner is visible while optimizer request is in-flight', async ({ page }) => {
  await page.route('**/api/optimize', async (route) => {
    await new Promise((r) => setTimeout(r, 400))
    await route.fulfill({ json: mockOptimizeResult })
  })
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByText(/running optimizer/i)).toBeVisible()
  // Spinner resolves and results appear
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()
})

test('results reset to empty state when a ticker chip is removed', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ'])
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()

  await page
    .getByTestId('chip-SPY')
    .getByRole('button', { name: /remove SPY/i })
    .click()

  await expect(page.getByTestId('weight-bar-SPY')).not.toBeVisible()
  await expect(page.getByText(/select assets.*run optimizer/i)).toBeVisible()
})

test('results reset to empty state when target_return slider changes', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ'])
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()

  await page.locator('input[type="range"]').first().fill('20')

  await expect(page.getByTestId('weight-bar-SPY')).not.toBeVisible()
  await expect(page.getByText(/select assets.*run optimizer/i)).toBeVisible()
})

test('results reset to empty state when horizon changes', async ({ page }) => {
  await runOptimizer(page, ['SPY', 'QQQ'])
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()

  await page.getByRole('button', { name: '5Y' }).click()

  await expect(page.getByTestId('weight-bar-SPY')).not.toBeVisible()
  await expect(page.getByText(/select assets.*run optimizer/i)).toBeVisible()
})

test('dismiss button on infeasibility error restores empty state', async ({ page }) => {
  await page.route('**/api/optimize', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: JSON.stringify({ error: 'infeasible', max_achievable: 0.1 }),
      }),
    })
  })
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByText(/not achievable/i)).toBeVisible()

  await page.getByRole('button', { name: /dismiss/i }).click()

  await expect(page.getByText(/select assets.*run optimizer/i)).toBeVisible()
  await expect(page.getByText(/not achievable/i)).not.toBeVisible()
})

test('non-422 server error shows generic error message', async ({ page }) => {
  await page.route('**/api/optimize', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Internal server error' }),
    })
  })
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByText(/an unexpected error occurred/i)).toBeVisible()
})

test('infeasibility error message quotes the max achievable return', async ({ page }) => {
  await page.route('**/api/optimize', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: JSON.stringify({ error: 'infeasible', max_achievable: 0.18 }),
      }),
    })
  })
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  // Should display the max achievable as a percentage: 18%
  await expect(page.getByText(/18%/)).toBeVisible()
  await expect(page.getByText(/not achievable/i)).toBeVisible()
})

test('infeasibility error message quotes the requested target return', async ({ page }) => {
  // Set target return to 50% before running
  await page.locator('input[type="range"]').first().fill('50')
  await page.route('**/api/optimize', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: JSON.stringify({ error: 'infeasible', max_achievable: 0.2 }),
      }),
    })
  })
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  // Error should mention both the requested 50% and the max 20%
  await expect(page.getByText(/50%/)).toBeVisible()
  await expect(page.getByText(/20%/)).toBeVisible()
})

test('sync button auto-populates from selected tickers', async ({ page }) => {
  await addTickers(page, ['SPY', 'QQQ'])

  // The sync text input should mirror the selected chips
  const syncInput = page.locator('input[type="text"][placeholder*="SPY"]')
  await expect(syncInput).toHaveValue('SPY,QQQ')
})
