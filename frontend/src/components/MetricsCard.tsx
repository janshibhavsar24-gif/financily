import type { PortfolioMetrics } from '../types/api'

interface Props {
  metrics: PortfolioMetrics
}

function formatPercent(value: number, showPlus = false): string {
  const pct = Math.round(value * 1000) / 10
  const sign = showPlus && pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatNegativePercent(value: number): string {
  const pct = Math.abs(Math.round(value * 1000) / 10)
  return `\u2212${pct.toFixed(1)}%`
}

interface MetricRow {
  label: string
  testId: string
  value: string
  red?: boolean
  bold?: boolean
}

export default function MetricsCard({ metrics }: Props) {
  const rows: MetricRow[] = [
    {
      label: 'Expected Return (pre-tax)',
      testId: 'expected_return_pretax',
      value: formatPercent(metrics.expected_return_pretax, true),
    },
    {
      label: 'Expected Return (after-tax)',
      testId: 'expected_return_aftertax',
      value: formatPercent(metrics.expected_return_aftertax, true),
    },
    {
      label: 'Volatility',
      testId: 'volatility',
      value: formatPercent(metrics.volatility),
    },
    {
      label: 'Sharpe Ratio',
      testId: 'sharpe_ratio',
      value: metrics.sharpe_ratio.toFixed(2),
    },
    {
      label: 'Max Drawdown (median)',
      testId: 'max_drawdown_median',
      value: formatNegativePercent(metrics.max_drawdown_median),
      red: true,
    },
    {
      label: 'Max Drawdown (95th pct)',
      testId: 'max_drawdown_p95',
      value: formatNegativePercent(metrics.max_drawdown_p95),
      red: true,
      bold: true,
    },
    {
      label: 'CVaR 95%',
      testId: 'cvar_95',
      value: formatNegativePercent(metrics.cvar_95),
      red: true,
    },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Portfolio Metrics
        </h3>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.testId} className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">{row.label}</p>
            <p
              data-testid={`metric-${row.testId}`}
              className={[
                'text-lg',
                row.bold ? 'font-bold' : 'font-semibold',
                row.red ? 'text-red-600' : 'text-gray-900',
              ].join(' ')}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
