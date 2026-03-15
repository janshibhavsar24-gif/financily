import type { TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(2)}%`
}

interface CalloutChipProps {
  ticker: string
  pct: number
  positive: boolean
}

function CalloutChip({ ticker, pct, positive }: CalloutChipProps) {
  const bg = positive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
  const tickerColor = positive ? 'text-emerald-800' : 'text-red-800'
  const pctColor = positive ? 'text-emerald-600' : 'text-red-600'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${bg}`}
      data-testid={`perf-chip-${ticker}`}
    >
      <span className={`font-semibold font-mono ${tickerColor}`}>{ticker}</span>
      <span className={`font-medium ${pctColor}`}>{fmtPct(pct)}</span>
    </span>
  )
}

export default function PerformanceCallouts({ holdings }: Props) {
  const valued = holdings.filter((h) => h.avg_pl_pct !== null)
  if (valued.length === 0) return null

  const sorted = [...valued].sort(
    (a, b) => (b.avg_pl_pct ?? 0) - (a.avg_pl_pct ?? 0),
  )

  const gainers = sorted.slice(0, 3).filter((h) => (h.avg_pl_pct ?? 0) >= 0)
  const losers = sorted
    .slice(-3)
    .reverse()
    .filter((h) => (h.avg_pl_pct ?? 0) < 0)

  if (gainers.length === 0 && losers.length === 0) return null

  return (
    <div className="flex flex-wrap gap-6">
      {gainers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Top Gainers
          </p>
          <div className="flex flex-wrap gap-2">
            {gainers.map((h) => (
              <CalloutChip
                key={h.ticker}
                ticker={h.ticker}
                pct={h.avg_pl_pct!}
                positive
              />
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Top Losers
          </p>
          <div className="flex flex-wrap gap-2">
            {losers.map((h) => (
              <CalloutChip
                key={h.ticker}
                ticker={h.ticker}
                pct={h.avg_pl_pct!}
                positive={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
