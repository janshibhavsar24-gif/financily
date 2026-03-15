import type { TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
}

const PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
]

function tickerColor(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export default function AllocationBars({ holdings }: Props) {
  const valued = holdings.filter((h) => h.allocation_pct !== null)
  if (valued.length === 0) return null

  const sorted = [...valued].sort(
    (a, b) => (b.allocation_pct ?? 0) - (a.allocation_pct ?? 0),
  )

  return (
    <div className="space-y-2">
      {sorted.map((h) => {
        const pct = Math.round((h.allocation_pct ?? 0) * 100)
        return (
          <div key={h.ticker} className="flex items-center gap-3">
            <span className="w-12 text-sm font-mono text-gray-700 text-right flex-shrink-0">
              {h.ticker}
            </span>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                data-testid={`alloc-bar-${h.ticker}`}
                className={`h-full ${tickerColor(h.ticker)} flex items-center px-2`}
                style={{ width: `${Math.max(pct, 1)}%` }}
              >
                {pct >= 8 && (
                  <span className="text-white text-xs font-semibold">{pct}%</span>
                )}
              </div>
            </div>
            {pct < 8 && <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>}
          </div>
        )
      })}
    </div>
  )
}
