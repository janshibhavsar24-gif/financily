import type { DriftResponse } from '../types/api'

interface Props {
  drift: DriftResponse
}

export default function WeightDriftTable({ drift }: Props) {
  if (!drift.has_run) {
    return (
      <p className="text-sm text-gray-400">
        No optimizer run found for current holdings. Run the optimizer first to track drift.
      </p>
    )
  }

  if (drift.items.length === 0) {
    return <p className="text-sm text-gray-400">No holdings to show drift for.</p>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="text-gray-600">
          Target return:{' '}
          <span className="font-medium text-gray-800">
            {drift.target_return !== null ? `${(drift.target_return * 100).toFixed(1)}%` : '—'}
          </span>
        </span>
        <span className="text-gray-600">
          Turnover score:{' '}
          <span className={`font-semibold ${
            drift.total_drift_score > 5 ? 'text-red-600' : drift.total_drift_score > 2 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {drift.total_drift_score.toFixed(1)}%
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Target %</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Current %</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Drift</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {drift.items.map((item) => (
              <tr
                key={item.ticker}
                className="border-b border-gray-100 hover:bg-gray-50"
                data-testid={`drift-row-${item.ticker}`}
              >
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">{item.ticker}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {item.target_weight.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                  {item.current_weight.toFixed(1)}%
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                  item.drift > 0 ? 'text-emerald-600' : item.drift < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {item.drift > 0 ? '+' : ''}{item.drift.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-center">
                  {item.drift_flag ? (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      Rebalance
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">On target</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
