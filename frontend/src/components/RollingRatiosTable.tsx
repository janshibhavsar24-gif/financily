import type { RollingRatiosResponse } from '../types/api'

interface Props {
  response: RollingRatiosResponse
}

const WINDOW_LABELS: Record<string, string> = {
  '30': '30d',
  '90': '90d',
  '180': '180d',
  '365': '1Y',
}

const METRICS = [
  { key: 'sortino', label: 'Sortino Ratio', higher: true },
  { key: 'calmar', label: 'Calmar Ratio', higher: true },
  { key: 'info_ratio', label: 'Info Ratio', higher: true },
] as const

function fmtRatio(v: number | null): string {
  if (v === null) return '—'
  return (v >= 0 ? '' : '') + v.toFixed(2)
}

function trendClass(values: (number | null)[]): string {
  const nonNull = values.filter((v): v is number => v !== null)
  if (nonNull.length < 2) return 'text-gray-700'
  const first = nonNull[0]
  const last = nonNull[nonNull.length - 1]
  if (last > first + 0.1) return 'text-emerald-600'
  if (last < first - 0.1) return 'text-red-600'
  return 'text-gray-700'
}

function valueClass(v: number | null): string {
  if (v === null) return 'text-gray-400'
  if (v > 1) return 'text-emerald-600 font-medium'
  if (v < 0) return 'text-red-600'
  return 'text-gray-700'
}

export default function RollingRatiosTable({ response }: Props) {
  const windowKeys = response.windows.map(String)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Metric
            </th>
            {windowKeys.map((w) => (
              <th key={w} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {WINDOW_LABELS[w] ?? `${w}d`}
              </th>
            ))}
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map(({ key, label }) => {
            const rowValues = windowKeys.map((w) => {
              const wMetrics = response.portfolio[w]
              return wMetrics ? (wMetrics[key as keyof typeof wMetrics] ?? null) : null
            })
            const trend = trendClass(rowValues)
            return (
              <tr
                key={key}
                className="border-b border-gray-100 hover:bg-gray-50"
                data-testid={`ratio-row-${key}`}
              >
                <td className="px-3 py-2 text-gray-700 font-medium">{label}</td>
                {rowValues.map((v, i) => (
                  <td key={windowKeys[i]} className={`px-3 py-2 text-right tabular-nums ${valueClass(v)}`}>
                    {fmtRatio(v)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs font-medium ${trend}`}>
                    {trend.includes('emerald') ? '↗' : trend.includes('red') ? '↘' : '→'}
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
