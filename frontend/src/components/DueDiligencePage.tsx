import { useState } from 'react'
import AssetSelector from './AssetSelector'
import StockTab from './StockTab'
import TabStrip from './TabStrip'

export default function DueDiligencePage() {
  const [pickerTickers, setPickerTickers] = useState<string[]>([])
  // openTabs are the tickers that have a live tab with a session
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  function handleRunDD() {
    if (pickerTickers.length === 0) return
    const newTabs = [...openTabs]
    for (const ticker of pickerTickers) {
      if (!newTabs.includes(ticker)) {
        newTabs.push(ticker)
      }
    }
    setOpenTabs(newTabs)
    // Activate the first ticker from the selection
    setActiveTab(pickerTickers[0])
  }

  function handleCloseTab(ticker: string) {
    const updated = openTabs.filter((t) => t !== ticker)
    setOpenTabs(updated)
    if (activeTab === ticker) {
      setActiveTab(updated[updated.length - 1] ?? null)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Stock Picker</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Select stocks for due diligence
          </p>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          <AssetSelector selected={pickerTickers} onChange={setPickerTickers} />

          <p className="text-xs text-gray-400">
            Tip: sync price data for richer statistics in the report.
          </p>

          <button
            type="button"
            onClick={handleRunDD}
            disabled={pickerTickers.length === 0}
            className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Run Due Diligence
          </button>
        </div>
      </aside>

      {/* Right panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {openTabs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select stocks and click{' '}
            <span className="font-semibold text-blue-600 mx-1">Run Due Diligence</span> to start.
          </div>
        ) : (
          <>
            <TabStrip
              tickers={openTabs}
              activeTab={activeTab}
              onSelect={setActiveTab}
              onClose={handleCloseTab}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab && openTabs.includes(activeTab) && (
                // Key forces StockTab to fully remount (and restart report) when ticker changes
                <StockTab key={activeTab} ticker={activeTab} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
