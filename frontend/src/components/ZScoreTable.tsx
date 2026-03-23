import { useState } from 'react'
import type { StockMonitor, TickerPL } from '../types/api'

interface Props {
  stocks: StockMonitor[]
  holdings: TickerPL[]
}

type SortKey = 'ticker' | 'z_score'
type SortDir = 'asc' | 'desc'

interface ZRow {
  ticker: string
  current_price: number | null
  mean_252: number | null
  z_score: number | null
  signal: string
  weight: number
}

function getSignal(z: number | null): string {
  if (z === null) return 'No Data'
  if (z > 2) return 'Overbought'
  if (z < -2) return 'Oversold'
  return 'Neutral'
}

function signalClass(signal: string): string {
  if (signal === 'Overbought') return 'text-red-600 font-medium'
  if (signal === 'Oversold') return 'text-emerald-600 font-medium'
  return 'text-gray-500'
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null) return '—'
  return v.toFixed(decimals)
}

export default function ZScoreTable({ stocks, holdings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('z_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const weightByTicker: Record<string, number> = {}
  for (const h of holdings) {
    weightByTicker[h.ticker] = (h.allocation_pct ?? 0) * 100
  }

  const rows: ZRow[] = stocks.map((s) => ({
    ticker: s.ticker,
    current_price: s.price,
    mean_252: s.price_52w_mean,
    z_score: s.price_zscore,
    signal: getSignal(s.price_zscore),
    weight: weightByTicker[s.ticker] ?? 0,
  }))

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity
    const bv = b[sortKey] ?? -Infinity
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const an = av as number
    const bn = bv as number
    return sortDir === 'asc' ? an - bn : bn - an
  })

  // Weighted average z-score
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0)
  const weightedZ = totalWeight > 0
    ? rows.reduce((s, r) => s + (r.z_score ?? 0) * r.weight, 0) / totalWeight
    : null

  function arrow(key: SortKey): string {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div>
      {weightedZ !== null && (
        <div className="mb-3 text-sm text-gray-600">
          Portfolio weighted avg Z-score:{' '}
          <span className={`font-semibold ${
            weightedZ > 1 ? 'text-red-600' : weightedZ < -1 ? 'text-emerald-600' : 'text-gray-800'
          }`}>
            {weightedZ.toFixed(2)}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                onClick={() => handleSort('ticker')}
                className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800"
              >
                Ticker{arrow('ticker')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                52W Mean
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Current Price
              </th>
              <th
                onClick={() => handleSort('z_score')}
                className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800"
              >
                Z-Score{arrow('z_score')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Signal
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.ticker}
                className="border-b border-gray-100 hover:bg-gray-50"
                data-testid={`zscore-row-${row.ticker}`}
              >
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">{row.ticker}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {row.mean_252 !== null ? `$${fmtNum(row.mean_252)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                  {row.current_price !== null ? `$${fmtNum(row.current_price)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-mono">
                  <span className={
                    row.z_score === null ? 'text-gray-400' :
                    row.z_score > 2 ? 'text-red-600 font-semibold' :
                    row.z_score < -2 ? 'text-emerald-600 font-semibold' :
                    'text-gray-700'
                  }>
                    {row.z_score !== null ? (row.z_score >= 0 ? '+' : '') + fmtNum(row.z_score) : '—'}
                  </span>
                </td>
                <td className={`px-3 py-2 text-sm ${signalClass(row.signal)}`}>
                  {row.signal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
