import { expect, test } from '@playwright/test'
import { setupApiMocks } from './mocks/api'

async function addTickers(page: import('@playwright/test').Page, tickers: string[]) {
  const input = page.getByRole('textbox', { name: /search assets/i })
  for (const ticker of tickers) {
    await input.fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker, 'i') }).click()
  }
}

test('shows infeasibility error when target return too high', async ({ page }) => {
  await setupApiMocks(page, {
    optimize: {
      status: 422,
      body: { detail: JSON.stringify({ error: 'infeasible', max_achievable: 0.14 }) },
    },
  })
  await page.goto('/')
  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByText(/14%/)).toBeVisible()
  await expect(page.getByText(/not achievable/i)).toBeVisible()
})

test('shows sync error message on backend failure', async ({ page }) => {
  await setupApiMocks(page, {
    sync: { status: 502, body: { detail: 'Yahoo Finance unavailable' } },
  })
  await page.goto('/')
  await addTickers(page, ['SPY'])
  await page.getByRole('button', { name: /sync data/i }).click()
  await expect(page.getByText('Yahoo Finance unavailable')).toBeVisible()
})

test('shows "no data — sync first" when assets list is empty', async ({ page }) => {
  await setupApiMocks(page, { assets: { assets: [] } })
  await page.goto('/')
  await page.getByRole('textbox', { name: /search assets/i }).click()
  await expect(page.getByText(/no data.*sync first/i)).toBeVisible()
})

test('RiskCostTable highlights row matching target return', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')

  // Default target_return is 12% (0.12) — set it to 20% via slider
  const slider = page.locator('input[type="range"]').first()
  await slider.fill('20')

  await addTickers(page, ['SPY', 'QQQ', 'TLT', 'GLD'])
  await page.getByRole('button', { name: /run optimizer/i }).click()

  const row = page.getByTestId('risk-row-0.20')
  await expect(row).toBeVisible()
  await expect(row).toHaveClass(/ring/)
})

test('MetricsCard formats negative drawdown with en-dash not hyphen', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  await addTickers(page, ['SPY', 'QQQ', 'TLT', 'GLD'])
  await page.getByRole('button', { name: /run optimizer/i }).click()

  const cell = page.getByTestId('metric-max_drawdown_p95')
  await expect(cell).toBeVisible()
  const text = await cell.textContent()
  // Must contain U+2212 (en-dash), not U+002D (hyphen-minus)
  expect(text).toMatch(/\u221231/)
  expect(text).not.toMatch(/^-/)
})

test('ParamForm horizon selector wires through to request body', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')

  let capturedBody: string | null = null
  await page.route('**/api/optimize', async (route) => {
    capturedBody = route.request().postData()
    await route.fulfill({ json: {} })
  })

  // Click the 5Y horizon button
  await page.getByRole('button', { name: '5Y' }).click()

  await addTickers(page, ['SPY', 'QQQ'])
  await page.getByRole('button', { name: /run optimizer/i }).click()

  await page.waitForTimeout(200)
  expect(capturedBody).not.toBeNull()
  const body = JSON.parse(capturedBody as string) as { horizon_years: number }
  expect(body.horizon_years).toBe(5)
})
