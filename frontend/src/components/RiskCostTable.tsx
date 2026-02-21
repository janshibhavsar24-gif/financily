// RiskCostTable — the core product insight: risk cost of each return target.
//
// Props (see requirement FE-011):
//   rows:         RiskCostRow[]    — efficient frontier sweep from the API
//   targetReturn: number           — the user's chosen target (e.g. 0.20)
//
// Rendering:
//   HTML <table> with 4 columns:
//     Target Return | Min Drawdown (p95) | Volatility | CVaR 95%
//   All values formatted as percentages.
//   Table caption: "Risk cost of each return target"
//
// Row highlighting (see requirement FE-011 and TST-008):
//   Find the row whose target_return is closest to the `targetReturn` prop.
//   Apply a Tailwind ring class to that row (e.g. ring-2 ring-blue-500).
//   This visually locates the user's current target on the frontier.
//
// data-testid per row: data-testid="risk-row-{target_return}"
//   e.g. data-testid="risk-row-0.20"
//   The value must match the numeric target_return exactly (not rounded).
//
// No charting library — plain HTML table only. See requirement FE-014.

// TODO: import React from 'react'
// TODO: import type { RiskCostRow } from '../types/api'

// TODO: interface Props {
//   rows: RiskCostRow[]
//   targetReturn: number
// }

// Helper: find the index of the row closest to targetReturn
// TODO: function closestRowIndex(rows: RiskCostRow[], target: number): number

// TODO: export default function RiskCostTable({ rows, targetReturn }: Props)
