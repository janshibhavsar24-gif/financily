import { useState } from 'react'
import type { ChatMessage } from '../types/api'
import AssetSelector from './AssetSelector'
import StockTab from './StockTab'
import TabStrip from './TabStrip'

export default function DueDiligencePage() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  // Tabs that have been opened (in order)
  const [openTickers, setOpenTickers] = useState<string[]>([])
  // Persisted messages per ticker (first entry = full report as assistant msg)
  const [sessions, setSessions] = useState<Record<string, ChatMessage[]>>({})
  const [activeTab, setActiveTab] = useState<string | null>(null)

  function handleRunDueDiligence() {
    if (selectedTickers.length === 0) return

    // Add any tickers not already open
    const newTickers = selectedTickers.filter((t) => !openTickers.includes(t))
    if (newTickers.length === 0) {
      // All already open — just switch to the first selected
      setActiveTab(selectedTickers[0])
      return
    }

    const updatedOpen = [...openTickers, ...newTickers]
    setOpenTickers(updatedOpen)
    // Activate the first newly added ticker
    setActiveTab(newTickers[0])
  }

  function handleTabSelect(ticker: string) {
    setActiveTab(ticker)
  }

  function handleTabClose(ticker: string) {
    const updated = openTickers.filter((t) => t !== ticker)
    setOpenTickers(updated)
    // Clean up session
    setSessions((prev) => {
      const copy = { ...prev }
      delete copy[ticker]
      return copy
    })
    // Switch active tab
    if (activeTab === ticker) {
      setActiveTab(updated.length > 0 ? updated[updated.length - 1] : null)
    }
  }

  function handleMessagesChange(ticker: string, messages: ChatMessage[]) {
    setSessions((prev) => ({ ...prev, [ticker]: messages }))
  }

  return (
    <div className="flex flex-1 min-h-0 h-full">
      {/* Left panel — stock picker */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Due Diligence
          </p>
          <p className="text-xs text-gray-400 mt-0.5">AI-powered stock analysis</p>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          <AssetSelector selected={selectedTickers} onChange={setSelectedTickers} />

          <button
            type="button"
            data-testid="dd-run-btn"
            onClick={handleRunDueDiligence}
            disabled={selectedTickers.length === 0}
            className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedTickers.length === 0
              ? 'Select stocks to analyse'
              : `Analyse ${selectedTickers.length} stock${selectedTickers.length > 1 ? 's' : ''}`}
          </button>

          {openTickers.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Open Reports
              </p>
              <ul className="space-y-1">
                {openTickers.map((ticker) => (
                  <li key={ticker}>
                    <button
                      type="button"
                      onClick={() => handleTabSelect(ticker)}
                      className={`w-full text-left text-sm px-2 py-1 rounded font-mono transition-colors ${
                        activeTab === ticker
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {ticker}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel — tabs + report */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {openTickers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 max-w-xs">
              <p className="text-gray-400 text-sm">
                Select one or more stocks and click{' '}
                <span className="font-semibold text-blue-600">Analyse</span> to generate AI due
                diligence reports.
              </p>
              <p className="text-xs text-gray-300">Requires ANTHROPIC_API_KEY in .env</p>
            </div>
          </div>
        ) : (
          <>
            <TabStrip
              tickers={openTickers}
              activeTab={activeTab}
              onSelect={handleTabSelect}
              onClose={handleTabClose}
            />
            <div className="flex-1 min-h-0">
              {openTickers.map((ticker) => (
                <div
                  key={ticker}
                  className={`h-full ${activeTab === ticker ? 'flex flex-col' : 'hidden'}`}
                >
                  <StockTab
                    ticker={ticker}
                    initialMessages={sessions[ticker] ?? []}
                    onMessagesChange={(msgs) => handleMessagesChange(ticker, msgs)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
