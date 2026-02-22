import type { RiskCostRow } from '../types/api'

interface Props {
  rows: RiskCostRow[]
  targetReturn: number
}

function closestRowIndex(rows: RiskCostRow[], target: number): number {
  let best = 0
  let bestDist = Math.abs(rows[0].target_return - target)
  for (let i = 1; i < rows.length; i++) {
    const dist = Math.abs(rows[i].target_return - target)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function negPct(value: number): string {
  return `\u2212${(Math.abs(value) * 100).toFixed(1)}%`
}

export default function RiskCostTable({ rows, targetReturn }: Props) {
  const highlightIdx = rows.length > 0 ? closestRowIndex(rows, targetReturn) : -1

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
          Risk cost of each return target
        </caption>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Target Return</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Min Drawdown (p95)</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Volatility</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">CVaR 95%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isHighlighted = idx === highlightIdx
            return (
              <tr
                key={row.target_return}
                data-testid={`risk-row-${row.target_return}`}
                className={[
                  'border-b border-gray-100 transition-colors',
                  isHighlighted
                    ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                    : 'hover:bg-gray-50',
                ].join(' ')}
              >
                <td className="py-2 px-3 font-medium text-gray-900">{pct(row.target_return)}</td>
                <td className="py-2 px-3 text-right text-red-600 font-medium">
                  {negPct(row.min_drawdown_p95)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">{pct(row.volatility)}</td>
                <td className="py-2 px-3 text-right text-red-600">{negPct(row.cvar_95)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
