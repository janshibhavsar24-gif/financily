interface Props {
  tickers: string[]
  activeTab: string | null
  onSelect: (ticker: string) => void
  onClose: (ticker: string) => void
}

export default function TabStrip({ tickers, activeTab, onSelect, onClose }: Props) {
  if (tickers.length === 0) return null

  return (
    <div className="flex items-center border-b border-gray-200 bg-white overflow-x-auto flex-shrink-0">
      {tickers.map((ticker) => {
        const isActive = ticker === activeTab
        return (
          <div
            key={ticker}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            data-testid={`dd-tab-${ticker}`}
            onClick={() => onSelect(ticker)}
          >
            <span className="text-sm font-semibold font-mono">{ticker}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose(ticker)
              }}
              className="text-xs text-gray-400 hover:text-gray-600 leading-none"
              aria-label={`Close ${ticker} tab`}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
