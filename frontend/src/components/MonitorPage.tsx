import { useCallback, useEffect, useState } from 'react'
import { addLot, deleteLot, updateLot } from '../api/client'
import { useEarnings } from '../hooks/useEarnings'
import { useMonitor } from '../hooks/useMonitor'
import { usePortfolio } from '../hooks/usePortfolio'
import { useThemeTags } from '../hooks/useThemeTags'
import { useWatchlists } from '../hooks/useWatchlists'
import type { EarningsDateRequest, LotPL, UpdateLotRequest } from '../types/api'
import AllocationBars from './AllocationBars'
import CorrelationMatrix from './CorrelationMatrix'
import EarningsCalendar from './EarningsCalendar'
import HeatMap from './HeatMap'
import HoldingsPLTable from './HoldingsPLTable'
import PerformanceCallouts from './PerformanceCallouts'
import PortfolioSummary from './PortfolioSummary'
import PositionHealthTable from './PositionHealthTable'
import PulseTable from './PulseTable'
import SparklineBar from './SparklineBar'
import ThematicClusters from './ThematicClusters'

const THEME_OPTIONS = ['AI Infrastructure', 'Energy Transition', 'Diversifiers']

export default function MonitorPage() {
  const { state: wlState, loadAll: loadWatchlists, create: createWl, rename: renameWl, remove: removeWl, select: selectWl } = useWatchlists()
  const { state: portfolioState, fetch: fetchPortfolio, reset: resetPortfolio } = usePortfolio()
  const { state: monitorState, fetch: fetchMonitor, reset: resetMonitor } = useMonitor()
  const { state: tagsState, load: loadTags, setTag, removeTag } = useThemeTags()
  const { state: earningsState, load: loadEarnings, add: addEarning, remove: removeEarning } = useEarnings()

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

  // Earnings form
  const [showEarningsForm, setShowEarningsForm] = useState(false)
  const [earningTicker, setEarningTicker] = useState('')
  const [earningDate, setEarningDate] = useState('')
  const [earningNote, setEarningNote] = useState('')
  const [addingEarning, setAddingEarning] = useState(false)

  const selectedId = wlState.selectedId

  // Refresh portfolio + tags + earnings when selected watchlist changes
  useEffect(() => {
    if (!selectedId) {
      resetPortfolio()
      resetMonitor()
      return
    }
    void fetchPortfolio(selectedId)
    void loadTags()
    void loadEarnings()
  }, [selectedId, fetchPortfolio, resetPortfolio, resetMonitor, loadTags, loadEarnings])

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

  const handleUpdateLot = useCallback(
    async (lotId: string, data: UpdateLotRequest) => {
      if (!selectedId) return
      await updateLot(selectedId, lotId, data)
      await Promise.all([fetchPortfolio(selectedId), loadWatchlists()])
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

  async function handleAddEarning() {
    if (!earningTicker.trim() || !earningDate) return
    setAddingEarning(true)
    try {
      const req: EarningsDateRequest = {
        ticker: earningTicker.trim().toUpperCase(),
        earnings_date: earningDate,
        note: earningNote.trim(),
      }
      await addEarning(req)
      setEarningTicker('')
      setEarningDate('')
      setEarningNote('')
      setShowEarningsForm(false)
    } catch {
      // non-critical
    } finally {
      setAddingEarning(false)
    }
  }

  const portfolio = portfolioState.result
  const holdings = portfolio?.holdings ?? []
  const stocks = monitorState.result?.stocks ?? []
  const stocksWithData = stocks.filter((s) => s.latest_date !== null)
  const portfolioTickers = holdings.map((h) => h.ticker)

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
              {/* Holdings list with theme dropdown */}
              {holdings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Holdings
                  </h3>
                  <div className="space-y-3">
                    {holdings.map((h) => (
                      <div key={h.ticker}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-gray-700 font-mono flex-1">
                            {h.ticker}
                          </p>
                          {/* F2 — theme tag dropdown */}
                          <select
                            value={tagsState.tags[h.ticker] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val) void setTag(h.ticker, val)
                              else void removeTag(h.ticker)
                            }}
                            className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 bg-white"
                            aria-label={`Theme for ${h.ticker}`}
                          >
                            <option value="">Untagged</option>
                            {THEME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        {h.lots.map((lot) => (
                          <LotRow
                            key={lot.lot_id}
                            lot={lot}
                            onDelete={handleDeleteLot}
                            onUpdate={handleUpdateLot}
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

              {/* F6 — Earnings Dates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Earnings Dates
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowEarningsForm((v) => !v)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Add
                  </button>
                </div>

                {showEarningsForm && (
                  <div className="space-y-1.5 mb-2">
                    <input
                      type="text"
                      aria-label="Earnings ticker"
                      value={earningTicker}
                      onChange={(e) => setEarningTicker(e.target.value.toUpperCase())}
                      placeholder="Ticker"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      aria-label="Earnings date"
                      value={earningDate}
                      onChange={(e) => setEarningDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      aria-label="Note (optional)"
                      value={earningNote}
                      onChange={(e) => setEarningNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void handleAddEarning()}
                        disabled={addingEarning || !earningTicker.trim() || !earningDate}
                        className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingEarning ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowEarningsForm(false); setEarningTicker(''); setEarningDate(''); setEarningNote('') }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing earnings entries for portfolio tickers */}
                <div className="space-y-0.5">
                  {earningsState.entries
                    .filter((e) => portfolioTickers.includes(e.ticker))
                    .map((e) => (
                      <div
                        key={`${e.ticker}-${e.earnings_date}`}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <span className="text-gray-600 font-mono">{e.ticker}</span>
                        <span className="text-gray-500">{e.earnings_date}</span>
                        <button
                          type="button"
                          onClick={() => void removeEarning(e.ticker, e.earnings_date)}
                          className="text-gray-300 hover:text-red-500 ml-1"
                          aria-label={`Remove earnings ${e.ticker} ${e.earnings_date}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
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

            {/* F2 — Thematic Clusters (shown when at least one ticker is tagged) */}
            {holdings.length > 0 && Object.keys(tagsState.tags).length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3">Thematic Clusters</h2>
                <ThematicClusters holdings={holdings} themeTags={tagsState.tags} />
              </section>
            )}

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

            {/* F6 — Earnings Calendar */}
            {earningsState.entries.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3">Upcoming Earnings</h2>
                <EarningsCalendar
                  entries={earningsState.entries}
                  portfolioTickers={portfolioTickers}
                />
              </section>
            )}

            {/* Market Data divider */}
            {stocksWithData.length > 0 && (
              <>
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Market Data
                  </p>
                </div>

                {/* F8 — Position Health Table */}
                {holdings.length > 0 && (
                  <section>
                    <h2 className="text-base font-bold text-gray-800 mb-3">Position Health</h2>
                    <PositionHealthTable holdings={holdings} stocks={stocksWithData} />
                  </section>
                )}

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
  onUpdate: (lotId: string, data: UpdateLotRequest) => Promise<void>
}

function LotRow({ lot, onDelete, onUpdate }: LotRowProps) {
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTicker, setEditTicker] = useState(lot.ticker)
  const [editAmount, setEditAmount] = useState(String(lot.amount))
  const [editDate, setEditDate] = useState(lot.purchase_date)
  const [editStopLoss, setEditStopLoss] = useState(
    lot.stop_loss_pct !== null ? String(lot.stop_loss_pct) : '',
  )

  // F3 — stop-loss alert badge
  const stopLossTriggered =
    lot.pl_pct !== null &&
    lot.stop_loss_pct !== null &&
    lot.pl_pct < -(lot.stop_loss_pct / 100)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(lot.lot_id)
    setDeleting(false)
  }

  function openEdit() {
    setEditTicker(lot.ticker)
    setEditAmount(String(lot.amount))
    setEditDate(lot.purchase_date)
    setEditStopLoss(lot.stop_loss_pct !== null ? String(lot.stop_loss_pct) : '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function handleSave() {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      const stopLossVal = editStopLoss.trim() !== '' ? parseFloat(editStopLoss) : null
      await onUpdate(lot.lot_id, {
        ticker: editTicker.trim().toUpperCase(),
        amount,
        purchase_date: editDate,
        stop_loss_pct: stopLossVal !== null && !isNaN(stopLossVal) ? stopLossVal : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid={`lot-row-${lot.lot_id}`}>
      {/* Row summary — always visible */}
      <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 group">
        <div className="min-w-0 flex items-center gap-1">
          <span className="text-xs text-gray-700" data-testid={`lot-amount-${lot.lot_id}`}>
            ${lot.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-gray-400 ml-1">{lot.purchase_date}</span>
          {lot.current_value === null && (
            <span className="text-xs text-amber-500 ml-1">no data</span>
          )}
          {/* F3 — stop-loss alert badge */}
          {stopLossTriggered && (
            <span className="text-xs font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full ml-1">
              stop-loss
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
          <button
            type="button"
            onClick={openEdit}
            className="text-gray-300 hover:text-blue-500 text-xs px-0.5"
            aria-label={`Edit lot ${lot.lot_id}`}
            data-testid={`edit-lot-${lot.lot_id}`}
          >
            ✎
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="text-gray-300 hover:text-red-500 text-xs px-0.5"
            aria-label={`Delete lot ${lot.lot_id}`}
            data-testid={`delete-lot-${lot.lot_id}`}
          >
            {deleting ? '…' : '×'}
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="mx-2 mb-1 p-2 bg-gray-50 border border-gray-200 rounded space-y-1.5">
          <input
            type="text"
            aria-label="Edit ticker"
            value={editTicker}
            onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
            placeholder="Ticker"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid={`edit-ticker-${lot.lot_id}`}
          />
          <input
            type="number"
            aria-label="Edit amount"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            placeholder="Amount (USD)"
            min="0"
            step="0.01"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid={`edit-amount-${lot.lot_id}`}
          />
          <input
            type="date"
            aria-label="Edit purchase date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid={`edit-date-${lot.lot_id}`}
          />
          {/* F3 — stop-loss field */}
          <input
            type="number"
            aria-label="Stop loss % (optional)"
            value={editStopLoss}
            onChange={(e) => setEditStopLoss(e.target.value)}
            placeholder="Stop loss % (e.g. 5 = −5%)"
            min="0"
            step="0.1"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid={`edit-stop-loss-${lot.lot_id}`}
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !editTicker.trim() || !editAmount || !editDate}
              className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              data-testid={`save-lot-${lot.lot_id}`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              data-testid={`cancel-edit-lot-${lot.lot_id}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
