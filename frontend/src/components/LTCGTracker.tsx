import type { LotPL } from '../types/api'

interface Props {
  lots: LotPL[]
}

interface LTCGRow {
  lot_id: string
  ticker: string
  pl_dollars: number
  days_held: number
  days_until_ltcg: number
  stcg_cost: number
  ltcg_cost: number
  tax_savings: number
}

const STCG_RATE = 0.37
const LTCG_RATE = 0.15

function buildRows(lots: LotPL[]): LTCGRow[] {
  const rows: LTCGRow[] = []
  for (const lot of lots) {
    if (
      lot.pl_dollars === null ||
      lot.pl_dollars <= 0 ||
      lot.days_held === null ||
      lot.days_held >= 365
    ) {
      continue
    }
    const days_until_ltcg = 365 - lot.days_held
    const stcg_cost = lot.pl_dollars * STCG_RATE
    const ltcg_cost = lot.pl_dollars * LTCG_RATE
    const tax_savings = stcg_cost - ltcg_cost
    rows.push({
      lot_id: lot.lot_id,
      ticker: lot.ticker,
      pl_dollars: lot.pl_dollars,
      days_held: lot.days_held,
      days_until_ltcg,
      stcg_cost,
      ltcg_cost,
      tax_savings,
    })
  }
  rows.sort((a, b) => a.days_until_ltcg - b.days_until_ltcg)
  return rows
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export default function LTCGTracker({ lots }: Props) {
  const rows = buildRows(lots)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No short-term gains approaching LTCG threshold.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticker</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Gain</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Held</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Until LTCG</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">STCG Tax</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">LTCG Tax</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Savings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const nearLtcg = row.days_until_ltcg <= 30
            return (
              <tr
                key={row.lot_id}
                className={`border-b border-gray-100 hover:bg-gray-50 ${nearLtcg ? 'bg-amber-50' : ''}`}
              >
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                  {row.ticker}
                  {nearLtcg && (
                    <span className="ml-1.5 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                      soon
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">
                  {fmtUsd(row.pl_dollars)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                  {row.days_held}d
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  <span className={nearLtcg ? 'text-amber-700' : 'text-gray-700'}>
                    {row.days_until_ltcg}d
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">
                  {fmtUsd(row.stcg_cost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {fmtUsd(row.ltcg_cost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">
                  {fmtUsd(row.tax_savings)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
