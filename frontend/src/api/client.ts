import type {
  AddLotRequest,
  AssetsResponse,
  ChatMessage,
  CreateWatchlistRequest,
  HoldingsResponse,
  LotInfo,
  MonitorResponse,
  OptimizeRequest,
  OptimizeResponse,
  PortfolioMetrics,
  PortfolioResponse,
  RenameWatchlistRequest,
  SearchResponse,
  SyncRequest,
  SyncResponse,
  WatchlistInfo,
  WatchlistListResponse,
  WatchlistRequest,
  WatchlistResponse,
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

export async function searchAssets(
  q: string,
  type?: string,
  sector?: string,
  country?: string,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q })
  if (type) params.set('type', type)
  if (sector) params.set('sector', sector)
  if (country) params.set('country', country)
  return request<SearchResponse>(`/api/search?${params}`)
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

export async function getWatchlist(): Promise<WatchlistResponse> {
  return request<WatchlistResponse>('/api/watchlist')
}

export async function saveWatchlist(req: WatchlistRequest): Promise<WatchlistResponse> {
  return request<WatchlistResponse>('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function getMonitorData(tickers: string[]): Promise<MonitorResponse> {
  const params = new URLSearchParams({ tickers: tickers.join(',') })
  return request<MonitorResponse>(`/api/monitor?${params}`)
}

// Named watchlists + portfolio P&L
export async function listWatchlists(): Promise<WatchlistListResponse> {
  return request<WatchlistListResponse>('/api/watchlists')
}

export async function createWatchlist(req: CreateWatchlistRequest): Promise<WatchlistInfo> {
  return request<WatchlistInfo>('/api/watchlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function renameWatchlist(
  id: string,
  req: RenameWatchlistRequest,
): Promise<WatchlistInfo> {
  return request<WatchlistInfo>(`/api/watchlists/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function deleteWatchlist(id: string): Promise<void> {
  await fetch(`/api/watchlists/${id}`, { method: 'DELETE' })
}

export async function getHoldings(watchlistId: string): Promise<HoldingsResponse> {
  return request<HoldingsResponse>(`/api/watchlists/${watchlistId}/holdings`)
}

export async function addLot(watchlistId: string, req: AddLotRequest): Promise<LotInfo> {
  return request<LotInfo>(`/api/watchlists/${watchlistId}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function deleteLot(watchlistId: string, lotId: string): Promise<void> {
  await fetch(`/api/watchlists/${watchlistId}/holdings/${lotId}`, { method: 'DELETE' })
}

export async function getPortfolio(watchlistId: string): Promise<PortfolioResponse> {
  return request<PortfolioResponse>(`/api/watchlists/${watchlistId}/portfolio`)
}

/**
 * Consume an SSE endpoint (POST) and call callbacks for each event.
 * Returns an abort function.
 */
function streamSSE(
  path: string,
  body: unknown,
  onToken: (text: string) => void,
  onDone: (meta?: Record<string, number>) => void,
  onError: (message: string) => void,
): () => void {
  const ctrl = new AbortController()

  ;(async () => {
    let res: Response
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        onError(err instanceof Error ? err.message : 'Network error')
      }
      return
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const json = await res.json()
        detail = typeof json.detail === 'string' ? json.detail : detail
      } catch {
        // ignore
      }
      onError(detail)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError('No response body')
      return
    }

    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (!payload) continue
          let evt: Record<string, unknown>
          try {
            evt = JSON.parse(payload) as Record<string, unknown>
          } catch {
            continue
          }
          if (evt.type === 'token') {
            onToken(String(evt.content ?? ''))
          } else if (evt.type === 'done') {
            onDone({
              input: Number(evt.input_tokens ?? 0),
              output: Number(evt.output_tokens ?? 0),
            })
          } else if (evt.type === 'error') {
            onError(String(evt.message ?? 'Unknown error'))
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        onError(err instanceof Error ? err.message : 'Stream read error')
      }
    }
  })()

  return () => ctrl.abort()
}

export function streamDDReport(
  ticker: string,
  onChunk: (text: string) => void,
  onDone: (tokens: { input: number; output: number }) => void,
  onError: (message: string) => void,
): () => void {
  return streamSSE(
    '/api/dd/report',
    { ticker },
    onChunk,
    (meta) => onDone({ input: meta?.input ?? 0, output: meta?.output ?? 0 }),
    onError,
  )
}

export function streamDDChat(
  ticker: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
): () => void {
  return streamSSE('/api/dd/chat', { ticker, messages }, onChunk, () => onDone(), onError)
}
