// WeightsBar — horizontal CSS bar chart of optimal portfolio weights.
//
// Props (see requirement FE-009):
//   weights: Record<string, number>    — e.g. { SPY: 0.35, QQQ: 0.25, ... }
//
// Rendering rules:
//   - Sort tickers descending by weight before rendering.
//   - Each row: a label ("SPY  35%") and a filled horizontal bar.
//   - Bar width = weight × 100% of the container width (use inline style).
//   - Each row must have data-testid="weight-bar-{TICKER}".
//   - Colors are assigned deterministically per ticker using a simple hash
//     of the ticker string mapped to a set of Tailwind bg-* classes.
//     The same ticker must always get the same color across renders.
//   - No charting library — pure CSS (flexbox + width style). See FE-014.

// TODO: import React from 'react'

// TODO: interface Props {
//   weights: Record<string, number>
// }

// Helper: deterministic color from ticker string
// TODO: function tickerColor(ticker: string): string
//   - hash the ticker characters → pick from a fixed palette of
//     Tailwind bg-* classes (e.g. bg-blue-500, bg-emerald-500, ...)

// TODO: export default function WeightsBar({ weights }: Props)
