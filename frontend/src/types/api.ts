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

// Named watchlists + portfolio P&L
export interface WatchlistInfo {
  id: string
  name: string
  holding_count: number
  created_at: string
}

export interface WatchlistListResponse {
  watchlists: WatchlistInfo[]
}

export interface CreateWatchlistRequest {
  name: string
}

export interface RenameWatchlistRequest {
  name: string
}

export interface LotInfo {
  lot_id: string
  ticker: string
  amount: number
  purchase_date: string
  added_at: string
  stop_loss_pct: number | null
}

export interface HoldingsResponse {
  watchlist_id: string
  watchlist_name: string
  holdings: LotInfo[]
}

export interface AddLotRequest {
  ticker: string
  amount: number
  purchase_date: string
}

export interface UpdateLotRequest {
  ticker: string
  amount: number
  purchase_date: string
  stop_loss_pct?: number | null
}

export interface LotPL {
  lot_id: string
  ticker: string
  amount: number
  purchase_date: string
  purchase_price: number | null
  current_price: number | null
  current_value: number | null
  pl_dollars: number | null
  pl_pct: number | null
  days_held: number | null
  stop_loss_pct: number | null
}

export interface TickerPL {
  ticker: string
  lots: LotPL[]
  total_amount: number
  total_current_value: number | null
  total_pl_dollars: number | null
  avg_pl_pct: number | null
  allocation_pct: number | null
  beta: number | null
  spy_return_pct: number | null
  alpha_pct: number | null
}

export interface PortfolioSummaryPL {
  total_invested: number
  total_current_value: number | null
  total_pl_dollars: number | null
  total_pl_pct: number | null
  spy_equivalent_value: number | null
  spy_return_pct: number | null
  as_of_date: string | null
  portfolio_beta: number | null
  alpha_pct: number | null
}

// Analytics — theme tags (F2) and earnings (F6)
export interface ThemeTagsResponse {
  tags: Record<string, string>
}

export interface ThemeTagRequest {
  theme: string
}

export interface EarningsDate {
  ticker: string
  earnings_date: string
  note: string
}

export interface EarningsDateRequest {
  ticker: string
  earnings_date: string
  note: string
}

export interface EarningsResponse {
  entries: EarningsDate[]
}

export interface PortfolioResponse {
  watchlist_id: string
  watchlist_name: string
  summary: PortfolioSummaryPL
  holdings: TickerPL[]
}
