import type { StockMonitor, TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
  stocks: StockMonitor[]
}

function fmt$(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(v)
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function plColor(v: number | null): string {
  if (v === null) return 'text-gray-500'
  return v >= 0 ? 'text-emerald-600' : 'text-red-600'
}

export default function PositionHealthTable({ holdings, stocks }: Props) {
  if (holdings.length === 0) return null

  const stockMap = new Map(stocks.map((s) => [s.ticker, s]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ticker
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Cost Basis
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Current
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              vs Cost
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              52W High
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              vs 52W High
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const stock = stockMap.get(h.ticker)
            const currentPrice = stock?.price ?? null
            const drawdown = stock?.drawdown_from_high ?? null

            // Cost basis = average purchase price per share implied by amounts/prices
            // We use total_amount (dollars invested) / current_value to estimate cost per share
            // More accurately: cost_basis_per_share = purchase_price (weighted avg from lots)
            const valuedLots = h.lots.filter(
              (l) => l.purchase_price !== null && l.current_price !== null,
            )
            let costBasis: number | null = null
            if (valuedLots.length > 0) {
              // Weighted average purchase price (weighted by dollar amount)
              const totalAmt = valuedLots.reduce((s, l) => s + l.amount, 0)
              const weightedPx = valuedLots.reduce(
                (s, l) => s + l.amount * (l.purchase_price as number),
                0,
              )
              costBasis = totalAmt > 0 ? weightedPx / totalAmt : null
            }

            // 52W high = currentPrice / (1 + drawdown) when drawdown < 0
            let high52w: number | null = null
            if (currentPrice !== null && drawdown !== null && drawdown < 0) {
              high52w = currentPrice / (1 + drawdown)
            } else if (currentPrice !== null && drawdown === 0) {
              high52w = currentPrice
            }

            return (
              <tr
                key={h.ticker}
                data-testid={`position-health-row-${h.ticker}`}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                  {h.ticker}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {costBasis !== null ? fmt$(costBasis) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {currentPrice !== null ? fmt$(currentPrice) : '—'}
                </td>
                <td className={`px-3 py-2 ${plColor(h.avg_pl_pct)}`}>
                  <span data-testid={`position-health-vs-cost-${h.ticker}`}>
                    {fmtPct(h.avg_pl_pct)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {high52w !== null ? fmt$(high52w) : '—'}
                </td>
                <td className="px-3 py-2 text-red-600">
                  <span data-testid={`position-health-vs-52w-${h.ticker}`}>
                    {drawdown !== null
                      ? `${(drawdown * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
