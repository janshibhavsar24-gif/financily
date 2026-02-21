// MetricsCard — 2-column grid displaying all portfolio risk/return metrics.
//
// Props (see requirement FE-010):
//   metrics: PortfolioMetrics
//
// Metrics to display and their formatting rules:
//
//   Expected Return (pre-tax)    → "+X.X%"   (green or neutral text)
//   Expected Return (after-tax)  → "+X.X%"   (green or neutral text)
//   Volatility                   → "X.X%"
//   Sharpe Ratio                 → "X.XX"    (2 decimal places)
//   Max Drawdown (median)        → "−X%"     (red text, en-dash U+2212 not hyphen)
//   Max Drawdown (95th pct)      → "−X%"     (red text, bold)
//   CVaR 95%                     → "−X%"     (red text)
//
// IMPORTANT — negative number formatting (see requirement FE-010 and TST-008):
//   Use the Unicode en-dash "−" (U+2212) for negative values, NOT a
//   hyphen-minus "-" (U+002D). This is verified by a Playwright test.
//   e.g. max_drawdown_p95 = -0.31 must display as "−31%", not "-31%".
//
// Each metric value cell must have:
//   data-testid="metric-{field_name}"
//   e.g. data-testid="metric-max_drawdown_p95"
//
// Helper: formatPercent(value: number, sign: boolean): string
//   Converts a decimal to a percentage string with optional + prefix.
//   Uses Math.round(value * 100) to avoid floating-point display issues.

// TODO: import React from 'react'
// TODO: import type { PortfolioMetrics } from '../types/api'

// TODO: interface Props {
//   metrics: PortfolioMetrics
// }

// TODO: function formatPercent(value: number, showPlus?: boolean): string
// TODO: function formatNegativePercent(value: number): string  ← uses en-dash

// TODO: export default function MetricsCard({ metrics }: Props)
