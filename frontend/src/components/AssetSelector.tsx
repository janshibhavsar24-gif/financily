import { useCallback, useEffect, useRef, useState } from 'react'
import { listAssets, searchAssets, syncTickers } from '../api/client'
import type { AssetInfo, SearchResult } from '../types/api'

interface Props {
  selected: string[]
  onChange: (tickers: string[]) => void
  refreshKey?: number
}

function qualityColor(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.5) return 'text-amber-500'
  return 'text-red-500'
}

function assetTypeLabel(type: string | null): string {
  if (!type) return ''
  const map: Record<string, string> = { equity: 'EQ', etf: 'ETF', fund: 'FUND', index: 'IDX' }
  return map[type.toLowerCase()] ?? type.toUpperCase().slice(0, 4)
}

export default function AssetSelector({ selected, onChange, refreshKey = 0 }: Props) {
  const [syncedAssets, setSyncedAssets] = useState<AssetInfo[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [syncingTicker, setSyncingTicker] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load synced assets on mount and whenever refreshKey changes
  useEffect(() => {
    listAssets()
      .then((res) => setSyncedAssets(res.assets))
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load assets')
      })
  }, [refreshKey])

  const runSearch = useCallback(
    (q: string) => {
      if (q.length === 0) {
        setSearchResults([])
        return
      }
      searchAssets(q)
        .then((res) => setSearchResults(res.results))
        .catch(() => setSearchResults([]))
    },
    [],
  )

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    setSyncError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
  }

  async function handleSelect(symbol: string, isSynced: boolean) {
    if (selected.includes(symbol)) return
    if (isSynced) {
      onChange([...selected, symbol])
      setQuery('')
      setOpen(false)
      inputRef.current?.focus()
      return
    }
    // Auto-sync unsynced assets
    setSyncingTicker(symbol)
    setSyncError(null)
    try {
      await syncTickers({ tickers: [symbol] })
      // Refresh synced list
      listAssets()
        .then((res) => setSyncedAssets(res.assets))
        .catch(() => undefined)
      onChange([...selected, symbol])
      setQuery('')
      setOpen(false)
      inputRef.current?.focus()
    } catch (err: unknown) {
      setSyncError(
        err instanceof Error ? err.message : `Failed to sync ${symbol}`,
      )
    } finally {
      setSyncingTicker(null)
    }
  }

  function removeTicker(ticker: string) {
    onChange(selected.filter((t) => t !== ticker))
  }

  // Decide what to show in the dropdown
  const showSearch = query.length > 0
  const dropdownItems: SearchResult[] = showSearch
    ? searchResults.filter((r) => !selected.includes(r.symbol))
    : syncedAssets
        .filter((a) => !selected.includes(a.ticker))
        .map((a) => ({
          symbol: a.ticker,
          name: a.name,
          asset_type: a.asset_type,
          sector: a.sector,
          country: null,
          exchange: null,
          is_synced: true,
          quality_score: a.quality_score,
        }))

  const isEmpty = showSearch
    ? searchResults.length === 0
    : syncedAssets.length === 0

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-8">
        {selected.map((ticker) => {
          const synced = syncedAssets.find((a) => a.ticker === ticker)
          return (
            <span
              key={ticker}
              data-testid={`chip-${ticker}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded"
            >
              {ticker}
              {synced && synced.quality_score < 0.5 && (
                <span
                  className="text-red-500 font-bold"
                  title={`Low data quality: ${synced.quality_score.toFixed(2)}`}
                >
                  ⚠
                </span>
              )}
              <button
                type="button"
                onClick={() => removeTicker(ticker)}
                className="text-blue-600 hover:text-blue-900 leading-none"
                aria-label={`Remove ${ticker}`}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          aria-label="Search assets"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search ticker or name…"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {open && (
          <div
            role="listbox"
            tabIndex={-1}
            className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto"
          >
            {fetchError ? (
              <div className="px-3 py-2 text-sm text-red-600">{fetchError}</div>
            ) : syncError ? (
              <div className="px-3 py-2 text-sm text-red-600">{syncError}</div>
            ) : isEmpty ? (
              <div className="px-3 py-2 text-sm text-gray-400">
                {showSearch ? 'No matches' : 'No data — sync first'}
              </div>
            ) : (
              dropdownItems.map((item) => {
                const isSyncing = syncingTicker === item.symbol
                return (
                  <div
                    key={item.symbol}
                    role="option"
                    tabIndex={-1}
                    aria-selected={false}
                    onMouseDown={() => handleSelect(item.symbol, item.is_synced)}
                    className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Synced / unsynced dot */}
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          item.is_synced ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={item.is_synced ? 'Synced' : 'Will sync on select'}
                      />
                      <span className="font-semibold text-gray-900 flex-shrink-0">
                        {item.symbol}
                      </span>
                      {item.asset_type && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded flex-shrink-0">
                          {assetTypeLabel(item.asset_type)}
                        </span>
                      )}
                      <span className="text-gray-400 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {item.is_synced && item.quality_score !== null && (
                        <span
                          className={`text-xs font-medium ${qualityColor(item.quality_score)}`}
                          title={`Data quality: ${item.quality_score.toFixed(2)}`}
                        >
                          {Math.round(item.quality_score * 100)}%
                        </span>
                      )}
                      {!item.is_synced && (
                        <span className="text-xs text-gray-400">sync</span>
                      )}
                      {isSyncing && (
                        <svg
                          aria-hidden={true}
                          className="animate-spin h-3.5 w-3.5 text-blue-500"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
