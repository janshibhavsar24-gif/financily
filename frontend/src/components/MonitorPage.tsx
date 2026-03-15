import { useCallback, useEffect, useState } from 'react'
import { addLot, deleteLot } from '../api/client'
import { useMonitor } from '../hooks/useMonitor'
import { usePortfolio } from '../hooks/usePortfolio'
import { useWatchlists } from '../hooks/useWatchlists'
import type { LotPL } from '../types/api'
import AllocationBars from './AllocationBars'
import CorrelationMatrix from './CorrelationMatrix'
import DrawdownMeter from './DrawdownMeter'
import HeatMap from './HeatMap'
import HoldingsPLTable from './HoldingsPLTable'
import PerformanceCallouts from './PerformanceCallouts'
import PortfolioSummary from './PortfolioSummary'
import PulseTable from './PulseTable'
import SparklineBar from './SparklineBar'

export default function MonitorPage() {
  const { state: wlState, loadAll: loadWatchlists, create: createWl, rename: renameWl, remove: removeWl, select: selectWl } = useWatchlists()
  const { state: portfolioState, fetch: fetchPortfolio, reset: resetPortfolio } = usePortfolio()
  const { state: monitorState, fetch: fetchMonitor, reset: resetMonitor } = useMonitor()

  // Lot management
  const [newLotTicker, setNewLotTicker] = useState('')
  const [newLotAmount, setNewLotAmount] = useState('')
  const [newLotDate, setNewLotDate] = useState('')
  const [addingLot, setAddingLot] = useState(false)
  const [addLotError, setAddLotError] = useState<string | null>(null)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  // New watchlist form
  const [showNewWlForm, setShowNewWlForm] = useState(false)
  const [newWlName, setNewWlName] = useState('')
  const [creatingWl, setCreatingWl] = useState(false)
  const [createWlError, setCreateWlError] = useState<string | null>(null)

  const selectedId = wlState.selectedId

  // Refresh portfolio when selected watchlist changes
  useEffect(() => {
    if (!selectedId) {
      resetPortfolio()
      resetMonitor()
      return
    }
    void fetchPortfolio(selectedId)
  }, [selectedId, fetchPortfolio, resetPortfolio, resetMonitor])

  // Refresh market data when portfolio loads
  useEffect(() => {
    if (!portfolioState.result) {
      resetMonitor()
      return
    }
    const tickers = portfolioState.result.holdings.map((h) => h.ticker)
    if (tickers.length === 0) {
      resetMonitor()
      return
    }
    void fetchMonitor(tickers)
  }, [portfolioState.result, fetchMonitor, resetMonitor])

  function handleRefresh() {
    if (selectedId) void fetchPortfolio(selectedId)
  }

  async function handleAddLot() {
    if (!selectedId || !newLotTicker.trim() || !newLotAmount || !newLotDate) return
    const amount = parseFloat(newLotAmount)
    if (isNaN(amount) || amount <= 0) {
      setAddLotError('Amount must be a positive number')
      return
    }
    setAddingLot(true)
    setAddLotError(null)
    try {
      await addLot(selectedId, {
        ticker: newLotTicker.trim().toUpperCase(),
        amount,
        purchase_date: newLotDate,
      })
      setNewLotTicker('')
      setNewLotAmount('')
      setNewLotDate('')
      await Promise.all([fetchPortfolio(selectedId), loadWatchlists()])
    } catch (err) {
      setAddLotError(err instanceof Error ? err.message : 'Failed to add lot')
    } finally {
      setAddingLot(false)
    }
  }

  const handleDeleteLot = useCallback(
    async (lotId: string) => {
      if (!selectedId) return
      try {
        await deleteLot(selectedId, lotId)
        await Promise.all([fetchPortfolio(selectedId), loadWatchlists()])
      } catch {
        // non-critical, silently ignore
      }
    },
    [selectedId, fetchPortfolio, loadWatchlists],
  )

  async function handleCreateWatchlist() {
    if (!newWlName.trim()) return
    setCreatingWl(true)
    setCreateWlError(null)
    try {
      await createWl(newWlName.trim())
      setNewWlName('')
      setShowNewWlForm(false)
    } catch (err) {
      setCreateWlError(err instanceof Error ? err.message : 'Failed to create watchlist')
    } finally {
      setCreatingWl(false)
    }
  }

  async function handleDeleteWatchlist() {
    if (!selectedId) return
    try {
      await removeWl(selectedId)
      resetPortfolio()
      resetMonitor()
    } catch {
      // non-critical
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return
    setRenameError(null)
    try {
      await renameWl(id, renameValue.trim())
      setRenamingId(null)
      setRenameValue('')
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename')
    }
  }

  const portfolio = portfolioState.result
  const holdings = portfolio?.holdings ?? []
  const stocks = monitorState.result?.stocks ?? []
  const stocksWithData = stocks.filter((s) => s.latest_date !== null)

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left sidebar */}
      <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            Portfolio Monitor
          </p>
        </div>

        <div className="flex-1 px-4 py-4 space-y-5">
          {/* Watchlist list */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Watchlists
              </h2>
              <button
                type="button"
                onClick={() => { setShowNewWlForm((v) => !v); setCreateWlError(null) }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                data-testid="new-watchlist-btn"
              >
                + New
              </button>
            </div>

            {/* New watchlist form */}
            {showNewWlForm && (
              <div className="mb-2 space-y-1">
                <input
                  type="text"
                  aria-label="New watchlist name"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateWatchlist() }}
                  placeholder="Watchlist name…"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  data-testid="new-watchlist-name-input"
                />
                {createWlError && (
                  <p className="text-xs text-red-600">{createWlError}</p>
                )}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCreateWatchlist()}
                    disabled={creatingWl || !newWlName.trim()}
                    className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    data-testid="create-watchlist-submit"
                  >
                    {creatingWl ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewWlForm(false); setNewWlName(''); setCreateWlError(null) }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Watchlist list items */}
            {wlState.loading && (
              <p className="text-xs text-gray-400">Loading…</p>
            )}
            {wlState.error && (
              <p className="text-xs text-red-600">{wlState.error}</p>
            )}
            <ul className="space-y-1">
              {wlState.watchlists.map((wl) => {
                const isSelected = wl.id === selectedId
                const isRenaming = renamingId === wl.id
                return (
                  <li
                    key={wl.id}
                    data-testid={`watchlist-item-${wl.id}`}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => { if (!isRenaming) selectWl(wl.id) }}
                  >
                    {isRenaming ? (
                      <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          aria-label="Rename watchlist"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRename(wl.id)
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                          }}
                          autoFocus
                          className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none"
                          data-testid={`rename-input-${wl.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => void handleRename(wl.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          data-testid={`rename-save-${wl.id}`}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRenamingId(null); setRenameValue('') }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`flex-1 min-w-0 text-sm truncate ${
                            isSelected ? 'text-blue-800 font-semibold' : 'text-gray-700'
                          }`}
                          data-testid={`watchlist-name-${wl.id}`}
                        >
                          {wl.name}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {wl.holding_count}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingId(wl.id)
                            setRenameValue(wl.name)
                            setRenameError(null)
                          }}
                          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 text-xs"
                          aria-label={`Rename ${wl.name}`}
                          data-testid={`rename-btn-${wl.id}`}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            {renameError && (
              <p className="text-xs text-red-600 mt-1">{renameError}</p>
            )}
          </section>

          {/* Selected watchlist details */}
          {selectedId && (
            <section className="space-y-4">
              {/* Holdings list */}
              {holdings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Holdings
                  </h3>
                  <div className="space-y-3">
                    {holdings.map((h) => (
                      <div key={h.ticker}>
                        <p className="text-xs font-semibold text-gray-700 font-mono mb-1">
                          {h.ticker}
                        </p>
                        {h.lots.map((lot) => (
                          <LotRow
                            key={lot.lot_id}
                            lot={lot}
                            onDelete={handleDeleteLot}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add lot form */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Add Purchase Lot
                </h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    aria-label="Ticker symbol"
                    value={newLotTicker}
                    onChange={(e) => setNewLotTicker(e.target.value.toUpperCase())}
                    placeholder="Ticker (e.g. AAPL)"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    data-testid="lot-ticker-input"
                  />
                  <input
                    type="number"
                    aria-label="Amount in USD"
                    value={newLotAmount}
                    onChange={(e) => setNewLotAmount(e.target.value)}
                    placeholder="Amount (USD)"
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    data-testid="lot-amount-input"
                  />
                  <input
                    type="date"
                    aria-label="Purchase date"
                    value={newLotDate}
                    onChange={(e) => setNewLotDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    data-testid="lot-date-input"
                  />
                  {addLotError && (
                    <p className="text-xs text-red-600">{addLotError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleAddLot()}
                    disabled={addingLot || !newLotTicker.trim() || !newLotAmount || !newLotDate}
                    className="w-full px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="add-lot-btn"
                  >
                    {addingLot ? 'Adding…' : 'Add Lot'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={portfolioState.loading}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  data-testid="refresh-btn"
                >
                  {portfolioState.loading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteWatchlist()}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  data-testid={`delete-watchlist-${selectedId}`}
                >
                  Delete
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* No watchlists */}
        {!wlState.loading && wlState.watchlists.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-gray-500 text-sm font-medium">No watchlists yet</p>
              <p className="text-gray-400 text-xs">
                Click "+ New" in the sidebar to create your first watchlist.
              </p>
            </div>
          </div>
        )}

        {/* No holdings in selected watchlist */}
        {!wlState.loading &&
          wlState.watchlists.length > 0 &&
          selectedId &&
          !portfolioState.loading &&
          holdings.length === 0 &&
          portfolioState.result !== null && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-gray-500 text-sm font-medium">No holdings yet</p>
              <p className="text-gray-400 text-xs">
                Add purchase lots using the form in the sidebar.
              </p>
            </div>
          </div>
        )}

        {/* Portfolio loading */}
        {portfolioState.loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <svg
                aria-hidden={true}
                className="animate-spin h-10 w-10 text-blue-600 mx-auto"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-500">Loading portfolio…</p>
            </div>
          </div>
        )}

        {/* Portfolio error */}
        {!portfolioState.loading && portfolioState.error && (
          <div className="max-w-xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
              <p className="text-sm font-semibold text-red-700 mb-1">Failed to load portfolio</p>
              <p className="text-sm text-red-600">{portfolioState.error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 text-xs text-red-700 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Portfolio data */}
        {!portfolioState.loading && portfolio !== null && holdings.length > 0 && (
          <div className="space-y-8 max-w-5xl">
            {/* Portfolio Summary */}
            <section>
              <PortfolioSummary summary={portfolio.summary} />
            </section>

            {/* Performance Callouts */}
            {holdings.some((h) => h.avg_pl_pct !== null) && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3">Performance</h2>
                <PerformanceCallouts holdings={holdings} />
              </section>
            )}

            {/* Allocation Bars */}
            {holdings.some((h) => h.allocation_pct !== null) && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3">Allocation</h2>
                <AllocationBars holdings={holdings} />
              </section>
            )}

            {/* Holdings P&L Table */}
            <section>
              <h2 className="text-base font-bold text-gray-800 mb-3">Holdings Detail</h2>
              <HoldingsPLTable holdings={holdings} />
            </section>

            {/* Market Data divider */}
            {stocksWithData.length > 0 && (
              <>
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Market Data
                  </p>
                </div>

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
                  <h2 className="text-base font-bold text-gray-800 mb-3">
                    Drawdown from 52W High
                  </h2>
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
                {monitorState.result?.correlation && (
                  <section>
                    <h2 className="text-base font-bold text-gray-800 mb-3">
                      Correlation Matrix
                    </h2>
                    <CorrelationMatrix matrix={monitorState.result.correlation} />
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lot row component
// ---------------------------------------------------------------------------

interface LotRowProps {
  lot: LotPL
  onDelete: (lotId: string) => Promise<void>
}

function LotRow({ lot, onDelete }: LotRowProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(lot.lot_id)
    setDeleting(false)
  }

  return (
    <div
      className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 group"
      data-testid={`lot-row-${lot.lot_id}`}
    >
      <div className="min-w-0">
        <span className="text-xs text-gray-700">
          ${lot.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
        <span className="text-xs text-gray-400 ml-1">{lot.purchase_date}</span>
        {lot.current_value === null && (
          <span className="text-xs text-amber-500 ml-1">no data</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs ml-1 flex-shrink-0"
        aria-label={`Delete lot ${lot.lot_id}`}
        data-testid={`delete-lot-${lot.lot_id}`}
      >
        {deleting ? '…' : '×'}
      </button>
    </div>
  )
}
