
interface Props {
  weights: Record<string, number>
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

export default function WeightsBar({ weights }: Props) {
  const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-2">
      {sorted.map(([ticker, weight]) => {
        const pct = Math.round(weight * 100)
        return (
          <div key={ticker} className="flex items-center gap-3">
            <span className="w-12 text-sm font-mono text-gray-700 text-right">{ticker}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                data-testid={`weight-bar-${ticker}`}
                className={`h-full ${tickerColor(ticker)} flex items-center px-2`}
                style={{ width: `${pct}%` }}
              >
                {pct >= 8 && (
                  <span className="text-white text-xs font-semibold">{pct}%</span>
                )}
              </div>
            </div>
            {pct < 8 && (
              <span className="text-xs text-gray-500">{pct}%</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
