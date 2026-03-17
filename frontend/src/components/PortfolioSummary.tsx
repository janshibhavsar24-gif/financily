import type { PortfolioSummaryPL } from '../types/api'

interface Props {
  summary: PortfolioSummaryPL
}

function fmt$(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(2)}%`
}

function plColor(v: number | null): string {
  if (v === null) return 'text-gray-700'
  return v >= 0 ? 'text-emerald-600' : 'text-red-600'
}

export default function PortfolioSummary({ summary }: Props) {
  const {
    total_invested,
    total_current_value,
    total_pl_dollars,
    total_pl_pct,
    spy_equivalent_value,
    spy_return_pct,
    as_of_date,
    portfolio_beta,
    alpha_pct,
  } = summary

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Portfolio Summary</h3>
        {as_of_date && (
          <span className="text-xs text-gray-400">as of {as_of_date}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Invested</p>
          <p className="text-lg font-bold text-gray-900" data-testid="summary-invested">
            {fmt$(total_invested)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Current Value</p>
          <p className="text-lg font-bold text-gray-900" data-testid="summary-current-value">
            {fmt$(total_current_value)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">P&amp;L $</p>
          <p
            className={`text-lg font-bold ${plColor(total_pl_dollars)}`}
            data-testid="summary-pl-dollars"
          >
            {fmt$(total_pl_dollars)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">P&amp;L %</p>
          <p
            className={`text-lg font-bold ${plColor(total_pl_pct)}`}
            data-testid="summary-pl-pct"
          >
            {fmtPct(total_pl_pct)}
          </p>
        </div>
      </div>

      {/* SPY benchmark */}
      <div className="pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-1">
          SPY Benchmark — if you had invested the same amounts in SPY
        </p>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-400">SPY Equivalent Value</p>
            <p className="text-sm font-semibold text-gray-700" data-testid="summary-spy-value">
              {fmt$(spy_equivalent_value)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">SPY Return %</p>
            <p
              className={`text-sm font-semibold ${plColor(spy_return_pct)}`}
              data-testid="summary-spy-return"
            >
              {fmtPct(spy_return_pct)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Portfolio β</p>
            <p
              className="text-sm font-semibold text-gray-700"
              data-testid="summary-beta"
            >
              {portfolio_beta !== null ? portfolio_beta.toFixed(2) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">α vs SPY</p>
            <p
              className={`text-sm font-semibold ${plColor(alpha_pct)}`}
              data-testid="summary-alpha"
            >
              {fmtPct(alpha_pct)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
