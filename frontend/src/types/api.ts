export interface AssetInfo {
  ticker: string
  name: string
  latest_date: string
  rows: number
  quality_score: number
  asset_type: string | null
  sector: string | null
}

export interface AssetsResponse {
  assets: AssetInfo[]
}

export interface SearchResult {
  symbol: string
  name: string
  asset_type: string | null
  sector: string | null
  country: string | null
  exchange: string | null
  is_synced: boolean
  quality_score: number | null
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
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
  unknown_tickers: string[]
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
  warnings: string[]
}

export interface InfeasibilityDetail {
  error: 'infeasible'
  max_achievable: number
}

export interface DDReportRequest {
  ticker: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface DDChatRequest {
  ticker: string
  messages: ChatMessage[]
}

export interface SparkBar {
  date: string
  ret: number
}

export interface StockMonitor {
  ticker: string
  latest_date: string | null
  price: number | null
  day_pct: number | null
  week_pct: number | null
  month_pct: number | null
  three_month_pct: number | null
  ann_volatility: number | null
  drawdown_from_high: number | null
  spark: SparkBar[]
}

export interface CorrelationMatrix {
  tickers: string[]
  values: number[][]
}

export interface MonitorResponse {
  stocks: StockMonitor[]
  correlation: CorrelationMatrix | null
}

export interface WatchlistResponse {
  tickers: string[]
}

export interface WatchlistRequest {
  tickers: string[]
}
