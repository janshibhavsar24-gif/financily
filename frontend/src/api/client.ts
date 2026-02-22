import type {
  AssetsResponse,
  OptimizeRequest,
  OptimizeResponse,
  PortfolioMetrics,
  SyncRequest,
  SyncResponse,
} from '../types/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // keep default detail
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export async function listAssets(): Promise<AssetsResponse> {
  return request<AssetsResponse>('/api/assets')
}

export async function syncTickers(req: SyncRequest): Promise<SyncResponse> {
  return request<SyncResponse>('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function optimizePortfolio(req: OptimizeRequest): Promise<OptimizeResponse> {
  return request<OptimizeResponse>('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function getRiskMetrics(
  tickers: string[],
  weights: number[],
  horizonYears: number,
): Promise<PortfolioMetrics> {
  const params = new URLSearchParams({
    tickers: tickers.join(','),
    weights: weights.join(','),
    horizon_years: String(horizonYears),
  })
  return request<PortfolioMetrics>(`/api/risk?${params}`)
}
