import type { StockMonitor, TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
  stocks: StockMonitor[]
}

// SPY reference sector weights
const SPY_WEIGHTS: Record<string, number> = {
  Technology: 31,
  'Health Care': 12,
  Financials: 13,
  'Consumer Discretionary': 10,
  Industrials: 9,
  'Communication Services': 9,
  'Consumer Staples': 6,
  Energy: 4,
  Materials: 2,
  'Real Estate': 3,
  Utilities: 2,
}

interface SectorRow {
  sector: string
  portfolio_pct: number
  spy_pct: number
  over_under: number
}

function buildRows(holdings: TickerPL[], stocks: StockMonitor[]): SectorRow[] {
  const sectorMap: Record<string, number> = {}
  const sectorByTicker: Record<string, string> = {}

  for (const s of stocks) {
    if (s.sector) {
      sectorByTicker[s.ticker] = s.sector
    }
  }

  let totalAlloc = 0
  for (const h of holdings) {
    const alloc = h.allocation_pct ?? 0
    totalAlloc += alloc
    const sector = sectorByTicker[h.ticker] ?? 'Unknown'
    sectorMap[sector] = (sectorMap[sector] ?? 0) + alloc
  }

  // Normalize to sum to 100
  const rows: SectorRow[] = []
  const allSectors = new Set([...Object.keys(sectorMap), ...Object.keys(SPY_WEIGHTS)])
  for (const sector of allSectors) {
    const rawAlloc = sectorMap[sector] ?? 0
    const portfolio_pct = totalAlloc > 0 ? (rawAlloc / totalAlloc) * 100 : 0
    const spy_pct = SPY_WEIGHTS[sector] ?? 0
    const over_under = portfolio_pct - spy_pct
    if (portfolio_pct > 0 || spy_pct > 0) {
      rows.push({ sector, portfolio_pct, spy_pct, over_under })
    }
  }

  rows.sort((a, b) => b.portfolio_pct - a.portfolio_pct)
  return rows
}

export default function SectorExposureTable({ holdings, stocks }: Props) {
  const rows = buildRows(holdings, stocks)
  const maxPct = Math.max(...rows.map((r) => Math.max(r.portfolio_pct, r.spy_pct)), 1)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">No sector data available.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sector</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Portfolio %</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">SPY %</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Over/Under</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Bar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overweight = row.over_under > 30
            return (
              <tr key={row.sector} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800">{row.sector}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-800">
                  {row.portfolio_pct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                  {row.spy_pct.toFixed(1)}%
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                  overweight
                    ? 'text-red-600'
                    : row.over_under > 0
                    ? 'text-emerald-600'
                    : 'text-gray-500'
                }`}>
                  {row.over_under > 0 ? '+' : ''}{row.over_under.toFixed(1)}%
                  {overweight && (
                    <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1 py-0.5 rounded-full">
                      high
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="relative h-4 bg-gray-100 rounded overflow-hidden w-32">
                    {/* SPY reference line */}
                    <div
                      className="absolute top-0 h-full bg-gray-300 opacity-60"
                      style={{ width: `${(row.spy_pct / maxPct) * 100}%` }}
                    />
                    {/* Portfolio bar */}
                    <div
                      className={`absolute top-0 h-full opacity-80 ${
                        overweight ? 'bg-red-400' : 'bg-blue-400'
                      }`}
                      style={{ width: `${(row.portfolio_pct / maxPct) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
