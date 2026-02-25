import { expect, test } from '@playwright/test'
import { setupApiMocks } from './mocks/api'

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
})

test('empty state shown on load', async ({ page }) => {
  await expect(page.getByText(/select assets.*run optimizer/i)).toBeVisible()
})

test('asset selector populates from /api/assets', async ({ page }) => {
  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SP')
  await expect(page.getByText('SPDR S&P 500 ETF')).toBeVisible()
})

test('can add and remove an asset chip', async ({ page }) => {
  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SPY')
  await page.getByRole('option', { name: /SPY/i }).click()

  const chip = page.getByTestId('chip-SPY')
  await expect(chip).toBeVisible()

  await chip.getByRole('button', { name: /remove SPY/i }).click()
  await expect(page.getByTestId('chip-SPY')).not.toBeVisible()
})

test('sync button shows success message', async ({ page }) => {
  // Add SPY
  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SPY')
  await page.getByRole('option', { name: /SPY/i }).click()

  await page.getByRole('button', { name: /sync data/i }).click()
  await expect(page.getByText(/synced.*120 rows/i)).toBeVisible()
})

test('happy path: full optimize run renders all result panels', async ({ page }) => {
  const input = page.getByRole('textbox', { name: /search assets/i })
  for (const ticker of ['SPY', 'QQQ', 'TLT', 'GLD']) {
    await input.fill(ticker)
    const option = page.getByRole('option', { name: new RegExp(ticker, 'i') })
    await expect(option).toBeVisible()
    await option.dispatchEvent('mousedown')
    await expect(page.getByTestId(`chip-${ticker}`)).toBeVisible()
  }

  await page.getByRole('button', { name: /run optimizer/i }).click()

  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()
  await expect(page.getByTestId('metric-max_drawdown_p95')).toBeVisible()
  await expect(page.getByText('Risk cost of each return target')).toBeVisible()
  await expect(page.getByText('Per-asset return forecasts (GARCH + shrinkage)')).toBeVisible()
})

test('run optimizer button is disabled while loading', async ({ page }) => {
  // Override optimize with a delayed response
  await page.route('**/api/optimize', async (route) => {
    await new Promise((r) => setTimeout(r, 500))
    await route.fulfill({ json: {} })
  })

  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SPY')
  await page.getByRole('option', { name: /SPY/i }).click()
  await input.fill('QQQ')
  await page.getByRole('option', { name: /QQQ/i }).click()

  const btn = page.getByRole('button', { name: /run optimizer/i })
  await btn.click()
  await expect(page.getByRole('button', { name: /optimizing/i })).toBeDisabled()
})
