import type {
  AssetsResponse,
  ChatMessage,
  OptimizeRequest,
  OptimizeResponse,
  PortfolioMetrics,
  SearchResponse,
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
