// TypeScript interfaces for every API request and response shape.
//
// Rules (see requirement FE-002):
//   - These are the single source of truth for API data types.
//   - Every component and hook imports types from here — no inline types.
//   - No `any`. Every field must be explicitly typed.
//   - Field names match the FastAPI response field names exactly (snake_case)
//     so JSON deserialization works without a transformation layer.
//
// Keep this file in sync with the Pydantic models in backend/api/.

// ---------------------------------------------------------------------------
// Asset listing (/api/assets)
// ---------------------------------------------------------------------------

// TODO: export interface AssetInfo {
//   ticker: string
//   name: string
//   latest_date: string
//   rows: number
// }

// TODO: export interface AssetsResponse {
//   assets: AssetInfo[]
// }

// ---------------------------------------------------------------------------
// Data sync (/api/sync)
// ---------------------------------------------------------------------------

// TODO: export interface SyncRequest {
//   tickers: string[]
//   lookback_years?: number        // default 10
// }

// TODO: export interface SyncResponse {
//   status: string
//   tickers_synced: number
//   rows_upserted: number
//   latest_date: string
// }

// ---------------------------------------------------------------------------
// Portfolio optimization (/api/optimize)
// ---------------------------------------------------------------------------

// TODO: export interface OptimizeRequest {
//   tickers: string[]
//   target_return: number          // e.g. 0.20 for 20%
//   horizon_years: number          // 2 | 3 | 5
//   max_weight: number             // e.g. 0.40
//   tax_rate_lt: number            // long-term cap gains rate
//   tax_rate_st: number            // short-term cap gains rate
//   n_simulations: number          // 1000 | 5000 | 10000
// }

// TODO: export interface PortfolioMetrics {
//   weights: Record<string, number>
//   expected_return_pretax: number
//   expected_return_aftertax: number
//   volatility: number
//   sharpe_ratio: number
//   max_drawdown_median: number    // negative float e.g. -0.18
//   max_drawdown_p95: number       // negative float e.g. -0.31
//   var_95: number                 // negative float
//   cvar_95: number                // negative float
// }

// TODO: export interface RiskCostRow {
//   target_return: number
//   min_drawdown_p95: number
//   volatility: number
//   cvar_95: number
// }

// TODO: export interface AssetForecast {
//   mu: number                     // annualised excess return
//   sigma: number                  // annualised GARCH volatility
// }

// TODO: export interface OptimizeResponse {
//   run_id: string
//   feasible: boolean
//   optimal_portfolio: PortfolioMetrics
//   risk_cost_table: RiskCostRow[]
//   forecasts: Record<string, AssetForecast>
// }

// ---------------------------------------------------------------------------
// Infeasibility error detail (/api/optimize → 422)
// ---------------------------------------------------------------------------

// TODO: export interface InfeasibilityDetail {
//   error: 'infeasible'
//   max_achievable: number         // e.g. 0.14 meaning 14% is the ceiling
// }
