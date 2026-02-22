export interface AssetInfo {
  ticker: string
  name: string
  latest_date: string
  rows: number
}

export interface AssetsResponse {
  assets: AssetInfo[]
}

export interface SyncRequest {
  tickers: string[]
  lookback_years?: number
}

export interface SyncResponse {
  status: string
  tickers_synced: number
  rows_upserted: number
  latest_date: string
}

export interface OptimizeRequest {
  tickers: string[]
  target_return: number
  horizon_years: number
  max_weight: number
  tax_rate_lt: number
  tax_rate_st: number
  n_simulations: number
}

export interface PortfolioMetrics {
  weights: Record<string, number>
  expected_return_pretax: number
  expected_return_aftertax: number
  volatility: number
  sharpe_ratio: number
  max_drawdown_median: number
  max_drawdown_p95: number
  var_95: number
  cvar_95: number
}

export interface RiskCostRow {
  target_return: number
  min_drawdown_p95: number
  volatility: number
  cvar_95: number
}

export interface AssetForecast {
  mu: number
  sigma: number
}

export interface OptimizeResponse {
  run_id: string
  feasible: boolean
  optimal_portfolio: PortfolioMetrics
  risk_cost_table: RiskCostRow[]
  forecasts: Record<string, AssetForecast>
}

export interface InfeasibilityDetail {
  error: 'infeasible'
  max_achievable: number
}
