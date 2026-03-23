import type { StressTestResponse } from '../types/api'

interface Props {
  response: StressTestResponse
  loading: boolean
  error: string | null
}

function lossBg(loss: number): string {
  if (loss <= -20) return 'text-red-700 font-bold'
  if (loss <= -10) return 'text-red-600 font-medium'
  if (loss < 0) return 'text-red-500'
  return 'text-emerald-600'
}

export default function StressTestPanel({ response, loading, error }: Props) {
  if (loading) {
    return <p className="text-sm text-gray-400">Running stress tests…</p>
  }
  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }
  if (response.scenarios.length === 0) {
    return <p className="text-sm text-gray-400">No scenario data available for these holdings.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenario</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Portfolio</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Worst Holding</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {response.scenarios.map((s) => (
            <tr
              key={s.name}
              className="border-b border-gray-100 hover:bg-gray-50"
              data-testid={`stress-row-${s.name.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                {s.start} → {s.end}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${lossBg(s.portfolio_loss_pct)}`}>
                {s.portfolio_loss_pct >= 0 ? '+' : ''}{s.portfolio_loss_pct.toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">
                {s.worst_ticker && s.worst_loss_pct !== null ? (
                  <span className="text-red-600">
                    {s.worst_ticker} {s.worst_loss_pct.toFixed(1)}%
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  s.coverage_pct >= 75
                    ? 'bg-emerald-100 text-emerald-700'
                    : s.coverage_pct >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {s.coverage_pct.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
