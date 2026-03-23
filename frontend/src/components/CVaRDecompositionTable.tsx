import type { CVaRDecompositionResponse } from '../types/api'

interface Props {
  response: CVaRDecompositionResponse
}

export default function CVaRDecompositionTable({ response }: Props) {
  const maxAbs = Math.max(...response.items.map((i) => Math.abs(i.cvar_contribution_pct)), 0.01)

  return (
    <div>
      <div className="mb-3 text-sm text-gray-600">
        Portfolio CVaR (95%):{' '}
        <span className="font-semibold text-red-700">
          {response.portfolio_cvar_95.toFixed(2)}%
        </span>
        <span className="ml-2 text-xs text-gray-400">
          (expected loss in worst 5% of scenarios)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">CVaR Contribution</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Bar</th>
            </tr>
          </thead>
          <tbody>
            {response.items.map((item) => {
              const barWidth = (Math.abs(item.cvar_contribution_pct) / maxAbs) * 100
              const isNegative = item.cvar_contribution_sign === 'negative'
              return (
                <tr
                  key={item.ticker}
                  className="border-b border-gray-100 hover:bg-gray-50"
                  data-testid={`cvar-row-${item.ticker}`}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                    {item.ticker}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {item.weight.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                    isNegative ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {item.cvar_contribution_pct >= 0 ? '+' : ''}{item.cvar_contribution_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-4 bg-gray-100 rounded overflow-hidden w-36">
                      <div
                        className={`h-full rounded ${isNegative ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
