interface Props {
  tickers: string[]
  activeTab: string | null
  onSelect: (ticker: string) => void
  onClose: (ticker: string) => void
}

export default function TabStrip({ tickers, activeTab, onSelect, onClose }: Props) {
  if (tickers.length === 0) return null

  return (
    <div className="flex border-b border-gray-200 bg-white overflow-x-auto flex-shrink-0">
      {tickers.map((ticker) => {
        const isActive = ticker === activeTab
        return (
          <div
            key={ticker}
            className={`flex items-center gap-1 px-4 py-2.5 cursor-pointer select-none border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            data-testid={`dd-tab-${ticker}`}
            onClick={() => onSelect(ticker)}
          >
            {ticker}
            <button
              type="button"
              className="ml-1 rounded-full w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onClose(ticker)
              }}
              aria-label={`Close ${ticker}`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
