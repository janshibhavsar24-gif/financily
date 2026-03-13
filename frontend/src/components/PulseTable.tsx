import { useState } from 'react'
import type { StockMonitor } from '../types/api'

type SortKey = 'ticker' | 'price' | 'day_pct' | 'week_pct' | 'month_pct' | 'three_month_pct' | 'ann_volatility'
type SortDir = 'asc' | 'desc'

interface Props {
  stocks: StockMonitor[]
}

function fmtPrice(v: number | null): string {
  if (v === null) return '—'
  return `$${v.toFixed(2)}`
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(2)}%`
}

function pctClass(v: number | null): string {
  if (v === null) return 'text-gray-400'
  if (v > 0) return 'text-emerald-600 font-medium'
  if (v < 0) return 'text-red-600 font-medium'
  return 'text-gray-600'
}

function sortValue(s: StockMonitor, key: SortKey): number | string {
  if (key === 'ticker') return s.ticker
  const v = s[key]
  return v ?? -Infinity
}

export default function PulseTable({ stocks }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'ticker' ? 'asc' : 'desc')
    }
  }

  const sorted = [...stocks].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const an = av as number
    const bn = bv as number
    return sortDir === 'asc' ? an - bn : bn - an
  })

  const cols: { key: SortKey; label: string }[] = [
    { key: 'ticker', label: 'Ticker' },
    { key: 'price', label: 'Price' },
    { key: 'day_pct', label: 'Day %' },
    { key: 'week_pct', label: '1W %' },
    { key: 'month_pct', label: '1M %' },
    { key: 'three_month_pct', label: '3M %' },
    { key: 'ann_volatility', label: 'Volatility' },
  ]

  function arrow(key: SortKey): string {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800"
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.ticker}
              data-testid={`pulse-row-${s.ticker}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-3 py-2 font-mono font-semibold text-gray-900">{s.ticker}</td>
              <td className="px-3 py-2 text-gray-700 tabular-nums">{fmtPrice(s.price)}</td>
              <td className={`px-3 py-2 tabular-nums ${pctClass(s.day_pct)}`}>
                {fmtPct(s.day_pct)}
              </td>
              <td className={`px-3 py-2 tabular-nums ${pctClass(s.week_pct)}`}>
                {fmtPct(s.week_pct)}
              </td>
              <td className={`px-3 py-2 tabular-nums ${pctClass(s.month_pct)}`}>
                {fmtPct(s.month_pct)}
              </td>
              <td className={`px-3 py-2 tabular-nums ${pctClass(s.three_month_pct)}`}>
                {fmtPct(s.three_month_pct)}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-600">
                {s.ann_volatility !== null ? `${(s.ann_volatility * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
