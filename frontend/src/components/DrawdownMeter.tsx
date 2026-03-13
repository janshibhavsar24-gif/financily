import type { StockMonitor } from '../types/api'

interface Props {
  stocks: StockMonitor[]
}

export default function DrawdownMeter({ stocks }: Props) {
  if (stocks.length === 0) return null

  return (
    <div className="space-y-2">
      {stocks.map((s) => {
        const dd = s.drawdown_from_high
        const widthPct = dd !== null ? Math.abs(dd) * 100 : 0
        const label =
          dd !== null
            ? `\u2212${(Math.abs(dd) * 100).toFixed(1)}% from 52W high`
            : 'no data — sync first'

        return (
          <div key={s.ticker} data-testid={`drawdown-bar-${s.ticker}`} className="flex items-center gap-3">
            <span className="w-12 text-sm font-mono text-gray-700 text-right flex-shrink-0">
              {s.ticker}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              {dd !== null && (
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${Math.min(widthPct, 100)}%` }}
                />
              )}
            </div>
            <span
              className={`text-xs w-40 flex-shrink-0 ${dd !== null ? 'text-red-600' : 'text-gray-400 italic'}`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
