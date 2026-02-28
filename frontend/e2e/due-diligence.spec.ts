/**
 * Due Diligence feature e2e tests
 *
 * These tests cover:
 *  - Navigation between Optimizer and Due Diligence views
 *  - Stock picker (select, chips, search filtering)
 *  - Tab creation and switching
 *  - Report streaming (spinner → content)
 *  - Multiple concurrent tabs with independent state
 *  - Chat: input visible after report, question/answer flow
 *  - Regenerate button
 *  - Tab close (removes tab, activates adjacent)
 *  - Error handling (503 from /api/dd/report)
 *
 * All backend calls are intercepted via page.route(); no real backend needed.
 */

import { expect, test } from '@playwright/test'
import { sseBody, setupApiMocks } from './mocks/api'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function goToDd(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /due diligence/i }).click()
}

async function pickTicker(page: import('@playwright/test').Page, ticker: string) {
  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill(ticker)
  const option = page.getByRole('option', { name: new RegExp(ticker, 'i') }).first()
  await expect(option).toBeVisible()
  await option.dispatchEvent('mousedown')
}

async function runDD(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /run due diligence/i }).click()
}

// ---------------------------------------------------------------------------
// Before each: set up all mocks, navigate to app
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
})

// ---------------------------------------------------------------------------
// 1. Navigation
// ---------------------------------------------------------------------------

test('Due Diligence nav button is visible in header', async ({ page }) => {
  await expect(page.getByRole('button', { name: /due diligence/i })).toBeVisible()
})

test('clicking Due Diligence tab switches view', async ({ page }) => {
  await goToDd(page)
  await expect(page.getByRole('button', { name: /run due diligence/i })).toBeVisible()
  // Optimizer-specific elements should be gone
  await expect(page.getByRole('button', { name: /run optimizer/i })).not.toBeVisible()
})

test('switching back to Optimizer restores its view', async ({ page }) => {
  await goToDd(page)
  await page.getByRole('button', { name: /optimizer/i }).first().click()
  await expect(page.getByRole('button', { name: /run optimizer/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Stock picker in DD view
// ---------------------------------------------------------------------------

test('DD stock picker shows search results', async ({ page }) => {
  await goToDd(page)
  await page.getByRole('textbox', { name: /search assets/i }).fill('AAPL')
  await expect(page.getByRole('option', { name: /AAPL/i })).toBeVisible()
})

test('selecting a stock creates a chip in DD picker', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await expect(page.getByTestId('chip-AAPL')).toBeVisible()
})

test('Run Due Diligence button is disabled when no stocks selected', async ({ page }) => {
  await goToDd(page)
  await expect(page.getByRole('button', { name: /run due diligence/i })).toBeDisabled()
})

test('Run Due Diligence button is enabled after selecting a stock', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await expect(page.getByRole('button', { name: /run due diligence/i })).toBeEnabled()
})

// ---------------------------------------------------------------------------
// 3. Tab creation
// ---------------------------------------------------------------------------

test('running DD on one stock opens a tab for that ticker', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  await expect(page.getByTestId('dd-tab-AAPL')).toBeVisible()
})

test('empty state shown before any stocks are submitted', async ({ page }) => {
  await goToDd(page)
  await expect(page.getByText(/select stocks and click/i)).toBeVisible()
  // No tab strip visible yet
  await expect(page.getByTestId('dd-tab-AAPL')).not.toBeVisible()
})

test('running DD on two stocks opens two tabs', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await pickTicker(page, 'MSFT')
  await runDD(page)
  await expect(page.getByTestId('dd-tab-AAPL')).toBeVisible()
  await expect(page.getByTestId('dd-tab-MSFT')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Report streaming
// ---------------------------------------------------------------------------

test('report content appears after streaming completes', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  // Report content from the mock SSE body
  await expect(page.getByText(/Apple Inc\. \(AAPL\)/)).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText(/Business Quality/)).toBeVisible()
})

test('report shows multiple sections from mock', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  // Use heading role to avoid strict-mode conflict with the markdown table rows
  await expect(page.getByRole('heading', { name: /Financial Strength/ })).toBeVisible({ timeout: 8_000 })
  await expect(page.getByRole('heading', { name: /Competitive Position/ })).toBeVisible()
  await expect(page.getByText(/30% revenue drop/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. Multiple tabs with independent content
// ---------------------------------------------------------------------------

test('MSFT tab shows MSFT-specific content', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await pickTicker(page, 'MSFT')
  await runDD(page)

  // Switch to MSFT tab
  await page.getByTestId('dd-tab-MSFT').click()
  await expect(page.getByText(/Microsoft Corporation/)).toBeVisible({ timeout: 8_000 })
})

test('switching tabs preserves report content of previous tab', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await pickTicker(page, 'MSFT')
  await runDD(page)

  // Wait for AAPL (first tab, auto-selected) to finish
  await expect(page.getByText(/Apple Inc\. \(AAPL\)/)).toBeVisible({ timeout: 8_000 })

  // Switch to MSFT
  await page.getByTestId('dd-tab-MSFT').click()
  await expect(page.getByText(/Microsoft Corporation/)).toBeVisible({ timeout: 8_000 })

  // Switch back to AAPL — content must still be there
  await page.getByTestId('dd-tab-AAPL').click()
  await expect(page.getByText(/Apple Inc\. \(AAPL\)/)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 6. Chat panel
// ---------------------------------------------------------------------------

test('chat input is not visible while report is streaming', async ({ page }) => {
  // Use a delayed mock so we can observe the streaming state
  await page.route('**/api/dd/report', async (route) => {
    await new Promise((r) => setTimeout(r, 400))
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([
        { type: 'token', content: '# AAPL\n\n' },
        { type: 'done', input_tokens: 10, output_tokens: 10 },
      ]),
    })
  })
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  // While still streaming, chat input should not be visible
  await expect(page.getByTestId('dd-chat-input-AAPL')).not.toBeVisible()
})

test('chat input appears after report finishes', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  await expect(page.getByText(/Apple Inc\. \(AAPL\)/)).toBeVisible({ timeout: 8_000 })
  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible()
})

test('typing a question and pressing Enter submits it and shows answer', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible({ timeout: 8_000 })

  await page.getByTestId('dd-chat-input-AAPL').fill("How does AAPL's debt compare to MSFT?")
  await page.getByTestId('dd-chat-input-AAPL').press('Enter')

  // User message appears in chat
  await expect(page.getByText(/How does AAPL's debt compare to MSFT\?/)).toBeVisible()
  // Mock answer appears
  await expect(page.getByText(/D\/E ratio/)).toBeVisible({ timeout: 8_000 })
})

test('Send button submits the chat question', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible({ timeout: 8_000 })
  await page.getByTestId('dd-chat-input-AAPL').fill('Tell me more about valuation')
  await page.getByRole('button', { name: /send/i }).click()

  await expect(page.getByText(/Tell me more about valuation/)).toBeVisible()
  await expect(page.getByText(/D\/E ratio/)).toBeVisible({ timeout: 8_000 })
})

test('Shift+Enter in chat input does not submit — textarea retains content', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible({ timeout: 8_000 })
  await page.getByTestId('dd-chat-input-AAPL').fill('Line one')
  await page.getByTestId('dd-chat-input-AAPL').press('Shift+Enter')
  // Input still has content — the question was not submitted and cleared
  await expect(page.getByTestId('dd-chat-input-AAPL')).toHaveValue(/Line one/)
})

// ---------------------------------------------------------------------------
// 7. Regenerate
// ---------------------------------------------------------------------------

test('Regenerate button re-fires the report stream', async ({ page }) => {
  // Track requests to /api/dd/report. React 18 StrictMode double-invokes effects
  // in development, so the initial render may fire 1–2 requests before Regenerate.
  // We snapshot the count before clicking and assert it grows by exactly 1 after.
  const reportRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/api/dd/report') && req.method() === 'POST') {
      reportRequests.push(req.url())
    }
  })

  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  // Wait for the report to finish (chat input visible)
  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible({ timeout: 8_000 })
  const countBeforeRegenerate = reportRequests.length

  // Regenerate — must fire exactly one more request
  await page.getByRole('button', { name: /regenerate/i }).click()
  await expect(page.getByText(/Apple Inc\. \(AAPL\)/)).toBeVisible({ timeout: 8_000 })
  expect(reportRequests.length).toBe(countBeforeRegenerate + 1)
})

test('Regenerate clears previous report text and chat', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  // Wait for report + chat to be ready
  await expect(page.getByTestId('dd-chat-input-AAPL')).toBeVisible({ timeout: 8_000 })
  await page.getByTestId('dd-chat-input-AAPL').fill('A question')
  await page.getByTestId('dd-chat-input-AAPL').press('Enter')
  await expect(page.getByText(/D\/E ratio/)).toBeVisible({ timeout: 8_000 })

  // Regenerate — chat history should be cleared
  await page.getByRole('button', { name: /regenerate/i }).click()
  await expect(page.getByText(/A question/)).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// 8. Tab close
// ---------------------------------------------------------------------------

test('closing the only tab returns to empty state', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)
  await expect(page.getByTestId('dd-tab-AAPL')).toBeVisible()

  await page.getByTestId('dd-tab-AAPL').getByRole('button', { name: /close AAPL/i }).click()
  await expect(page.getByTestId('dd-tab-AAPL')).not.toBeVisible()
  // Empty state prompt returns
  await expect(page.getByText(/run due diligence/i).last()).toBeVisible()
})

test('closing one of two tabs leaves the other active', async ({ page }) => {
  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await pickTicker(page, 'MSFT')
  await runDD(page)

  await expect(page.getByTestId('dd-tab-AAPL')).toBeVisible()
  await expect(page.getByTestId('dd-tab-MSFT')).toBeVisible()

  await page.getByTestId('dd-tab-AAPL').getByRole('button', { name: /close AAPL/i }).click()

  await expect(page.getByTestId('dd-tab-AAPL')).not.toBeVisible()
  await expect(page.getByTestId('dd-tab-MSFT')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 9. Error handling
// ---------------------------------------------------------------------------

test('503 from /api/dd/report shows error box with retry', async ({ page }) => {
  await page.route('**/api/dd/report', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'ANTHROPIC_API_KEY not configured' }),
    })
  })

  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  await expect(page.getByText(/ANTHROPIC_API_KEY not configured/)).toBeVisible({ timeout: 8_000 })
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
})

test('error SSE event shows error box', async ({ page }) => {
  await page.route('**/api/dd/report', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([{ type: 'error', message: 'Anthropic rate limit exceeded' }]),
    })
  })

  await goToDd(page)
  await pickTicker(page, 'AAPL')
  await runDD(page)

  await expect(page.getByText(/Anthropic rate limit exceeded/)).toBeVisible({ timeout: 8_000 })
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
})
