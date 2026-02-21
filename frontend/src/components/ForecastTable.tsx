// ForecastTable — per-asset return and volatility forecasts from the engine.
//
// Props (see requirement FE-012):
//   forecasts: Record<string, AssetForecast>
//             e.g. { SPY: { mu: 0.082, sigma: 0.161 }, QQQ: { ... } }
//
// Rendering:
//   HTML <table> with 3 columns:
//     Ticker | Expected Excess Return | Forecast Volatility
//   Table caption: "Per-asset return forecasts (GARCH + shrinkage)"
//   Both mu and sigma formatted as percentages (e.g. "8.2%", "16.1%").
//   Rows sorted alphabetically by ticker.
//
// Notes:
//   - mu is an excess return (risk-free rate already subtracted).
//     The column header should make this clear ("Exp. Excess Return").
//   - sigma is GARCH(1,1) annualised volatility.
//   - No data-testid required on individual rows (not tested at row level).

// TODO: import React from 'react'
// TODO: import type { AssetForecast } from '../types/api'

// TODO: interface Props {
//   forecasts: Record<string, AssetForecast>
// }

// TODO: export default function ForecastTable({ forecasts }: Props)
