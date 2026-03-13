import { useCallback, useEffect, useState } from 'react'
import { getWatchlist, saveWatchlist } from '../api/client'
import { useMonitor } from '../hooks/useMonitor'
import AssetSelector from './AssetSelector'
import CorrelationMatrix from './CorrelationMatrix'
import DrawdownMeter from './DrawdownMeter'
import HeatMap from './HeatMap'
import PulseTable from './PulseTable'
import SparklineBar from './SparklineBar'

export default function MonitorPage() {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchlistLoaded, setWatchlistLoaded] = useState(false)
  const [assetRefreshKey] = useState(0)
  const { state, fetch, reset } = useMonitor()

  // Load watchlist on mount
  useEffect(() => {
    getWatchlist()
      .then((res) => {
        setWatchlist(res.tickers)
        setWatchlistLoaded(true)
      })
      .catch(() => {
        setWatchlistLoaded(true)
      })
  }, [])

  // Fetch monitor data whenever watchlist changes (after initial load)
  useEffect(() => {
    if (!watchlistLoaded) return
    if (watchlist.length === 0) {
      reset()
      return
    }
    void fetch(watchlist)
  }, [watchlist, watchlistLoaded, fetch, reset])

  const handleTickersChange = useCallback(
    (tickers: string[]) => {
      setWatchlist(tickers)
      saveWatchlist({ tickers }).catch(() => {
        // persist failure is non-critical; state is still updated locally
      })
    },
    [],
  )

  function handleRefresh() {
    if (watchlist.length > 0) {
      void fetch(watchlist)
    }
  }

  const stocks = state.result?.stocks ?? []
  const stocksWithData = stocks.filter((s) => s.latest_date !== null)
  const stocksNoData = stocks.filter((s) => s.latest_date === null)

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left sidebar */}
      <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs text-gray-500">Portfolio Monitor</p>
        </div>

        <div className="flex-1 px-5 py-4 space-y-6">
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Watchlist
            </h2>
            <AssetSelector
              selected={watchlist}
              onChange={handleTickersChange}
              refreshKey={assetRefreshKey}
            />
          </section>

          {watchlist.length > 0 && (
            <section>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={state.loading}
                className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </section>
          )}

          {stocksNoData.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                No data — sync first
              </p>
              <div className="flex flex-wrap gap-1">
                {stocksNoData.map((s) => (
                  <span
                    key={s.ticker}
                    className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-mono border border-amber-200"
                  >
                    {s.ticker}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Empty state */}
        {!watchlistLoaded || (watchlist.length === 0 && !state.loading) ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-gray-400 text-sm">
                Add tickers to your watchlist to monitor their performance.
              </p>
              <p className="text-gray-400 text-xs">
                Use the selector on the left, then sync data if needed.
              </p>
            </div>
          </div>
        ) : null}

        {/* Loading */}
        {state.loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <svg
                aria-hidden={true}
                className="animate-spin h-10 w-10 text-blue-600 mx-auto"
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
              <p className="text-sm text-gray-500">Loading monitor data…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!state.loading && state.error !== null && (
          <div className="max-w-xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
              <p className="text-sm font-semibold text-red-700 mb-1">Failed to load data</p>
              <p className="text-sm text-red-600">{state.error}</p>
              <button
                type="button"
                onClick={() => { reset(); void fetch(watchlist) }}
                className="mt-3 text-xs text-red-700 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {!state.loading && state.result !== null && stocksWithData.length > 0 && (
          <div className="space-y-10 max-w-5xl">
            {/* Daily Heat Map */}
            <section>
              <h2 className="text-base font-bold text-gray-800 mb-3">Daily Heat Map</h2>
              <HeatMap stocks={stocksWithData} />
            </section>

            {/* Pulse Table */}
            <section>
              <h2 className="text-base font-bold text-gray-800 mb-3">Pulse Table</h2>
              <PulseTable stocks={stocksWithData} />
            </section>

            {/* Drawdown Meter */}
            <section>
              <h2 className="text-base font-bold text-gray-800 mb-3">Drawdown from 52W High</h2>
              <DrawdownMeter stocks={stocksWithData} />
            </section>

            {/* 30-Day Sparklines */}
            <section>
              <h2 className="text-base font-bold text-gray-800 mb-3">30-Day Returns</h2>
              <div className="space-y-3">
                {stocksWithData.map((s) => (
                  <div key={s.ticker} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-mono text-gray-700 text-right flex-shrink-0">
                      {s.ticker}
                    </span>
                    <div className="flex-1">
                      <SparklineBar ticker={s.ticker} spark={s.spark} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Correlation Matrix */}
            {state.result.correlation !== null && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3">Correlation Matrix</h2>
                <CorrelationMatrix matrix={state.result.correlation} />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
