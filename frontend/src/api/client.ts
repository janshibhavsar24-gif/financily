// Typed API client — one function per backend endpoint.
//
// Rules (see requirement FE-003):
//   - Every function is async and returns a typed Promise.
//   - On a non-2xx response, throw ApiError with .status and .detail.
//     Never throw a generic Error for API failures.
//   - No `any`. Import all types from src/types/api.ts.
//   - BASE is an empty string so all paths are relative — Vite dev proxy
//     forwards /api/* to localhost:8000 transparently.
//
// Usage example:
//   import { optimizePortfolio } from './api/client'
//   const result = await optimizePortfolio({ tickers: ['SPY'], ... })

// TODO: import all needed types from '../types/api'

// ---------------------------------------------------------------------------
// ApiError — thrown on any non-2xx response
// ---------------------------------------------------------------------------

// TODO: export class ApiError extends Error {
//   constructor(
//     public status: number,
//     public detail: string,         // human-readable error from FastAPI
//   ) { super(detail) }
// }

// ---------------------------------------------------------------------------
// Internal helper — shared fetch logic + error handling
// ---------------------------------------------------------------------------

// TODO: async function request<T>(
//   path: string,
//   options?: RequestInit,
// ): Promise<T>
//   - fetch(path, options)
//   - if !response.ok: parse body as JSON, throw ApiError(status, detail)
//   - return response.json() as T

// ---------------------------------------------------------------------------
// GET /api/assets
// List all tickers currently stored in the local DB.
// ---------------------------------------------------------------------------

// TODO: export async function listAssets(): Promise<AssetsResponse>

// ---------------------------------------------------------------------------
// POST /api/sync
// Trigger incremental data sync for a list of tickers.
// ---------------------------------------------------------------------------

// TODO: export async function syncTickers(req: SyncRequest): Promise<SyncResponse>

// ---------------------------------------------------------------------------
// POST /api/optimize
// Run the full engine pipeline: forecast → covariance → optimize → tax.
// Throws ApiError(422) on infeasibility — caller should check .detail for
// InfeasibilityDetail shape.
// ---------------------------------------------------------------------------

// TODO: export async function optimizePortfolio(
//   req: OptimizeRequest,
// ): Promise<OptimizeResponse>

// ---------------------------------------------------------------------------
// GET /api/risk
// Compute risk metrics for an arbitrary user-supplied portfolio (no optimization).
// ---------------------------------------------------------------------------

// TODO: export async function getRiskMetrics(
//   tickers: string[],
//   weights: number[],
//   horizonYears: number,
// ): Promise<PortfolioMetrics>
