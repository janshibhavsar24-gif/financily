import type { TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
  themeTags: Record<string, string>
}

function fmt$(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(2)}%`
}

function plColor(v: number | null): string {
  if (v === null) return 'text-gray-500'
  return v >= 0 ? 'text-emerald-600' : 'text-red-600'
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ThematicClusters({ holdings, themeTags }: Props) {
  if (holdings.length === 0) return null

  // Group holdings by theme
  const clusterMap: Record<string, TickerPL[]> = {}
  for (const h of holdings) {
    const theme = themeTags[h.ticker] ?? 'Untagged'
    if (!clusterMap[theme]) clusterMap[theme] = []
    clusterMap[theme].push(h)
  }

  // Total portfolio current value for allocation bar
  const totalPortfolioValue = holdings.reduce(
    (sum, h) => sum + (h.total_current_value ?? 0),
    0,
  )

  const clusterNames = Object.keys(clusterMap).sort((a, b) => {
    if (a === 'Untagged') return 1
    if (b === 'Untagged') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-4">
      {clusterNames.map((name) => {
        const tickers = clusterMap[name]
        const invested = tickers.reduce((s, h) => s + h.total_amount, 0)
        const currentValue = tickers.reduce(
          (s, h) => s + (h.total_current_value ?? 0),
          0,
        )
        const valuedTickers = tickers.filter((h) => h.total_current_value !== null)
        const investedWithData = valuedTickers.reduce((s, h) => s + h.total_amount, 0)
        const plDollars = valuedTickers.length > 0 ? currentValue - investedWithData : null
        const plPct = plDollars !== null && investedWithData > 0
          ? plDollars / investedWithData
          : null
        const allocationPct = totalPortfolioValue > 0 ? currentValue / totalPortfolioValue : 0

        return (
          <div
            key={name}
            data-testid={`cluster-row-${slugify(name)}`}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">{name}</h3>
              <span className="text-xs text-gray-400">
                {tickers.map((h) => h.ticker).join(' · ')}
              </span>
            </div>

            {/* Allocation bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${Math.min(allocationPct * 100, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Invested</p>
                <p className="font-semibold text-gray-700">{fmt$(invested)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Current Value</p>
                <p className="font-semibold text-gray-700">
                  {valuedTickers.length > 0 ? fmt$(currentValue) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">P&amp;L $</p>
                <p className={`font-semibold ${plColor(plDollars)}`}>{fmt$(plDollars)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">P&amp;L %</p>
                <p className={`font-semibold ${plColor(plPct)}`}>{fmtPct(plPct)}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
