import { useState } from 'react'
import type { TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
}

type SortKey = 'ticker' | 'lots' | 'invested' | 'current_value' | 'pl_dollars' | 'pl_pct' | 'allocation' | 'beta' | 'alpha'
type SortDir = 'asc' | 'desc'

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

function SortHeader({
  label,
  col,
  current,
  dir,
  onClick,
}: {
  label: string
  col: SortKey
  current: SortKey
  dir: SortDir
  onClick: (c: SortKey) => void
}) {
  const active = current === col
  return (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800"
      onClick={() => onClick(col)}
      role="columnheader"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="flex items-center gap-1">
        {label}
        {active && (
          <span className="text-blue-500">{dir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )
}

export default function HoldingsPLTable({ holdings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('current_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    let va: number | string | null = null
    let vb: number | string | null = null
    switch (sortKey) {
      case 'ticker':
        va = a.ticker
        vb = b.ticker
        break
      case 'lots':
        va = a.lots.length
        vb = b.lots.length
        break
      case 'invested':
        va = a.total_amount
        vb = b.total_amount
        break
      case 'current_value':
        va = a.total_current_value
        vb = b.total_current_value
        break
      case 'pl_dollars':
        va = a.total_pl_dollars
        vb = b.total_pl_dollars
        break
      case 'pl_pct':
        va = a.avg_pl_pct
        vb = b.avg_pl_pct
        break
      case 'allocation':
        va = a.allocation_pct
        vb = b.allocation_pct
        break
      case 'beta':
        va = a.beta
        vb = b.beta
        break
      case 'alpha':
        va = a.alpha_pct
        vb = b.alpha_pct
        break
    }
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    const na = va as number
    const nb = vb as number
    return sortDir === 'asc' ? na - nb : nb - na
  })

  if (sorted.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <SortHeader label="Ticker" col="ticker" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="Lots" col="lots" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="Invested" col="invested" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="Current Value" col="current_value" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="P&L $" col="pl_dollars" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="P&L %" col="pl_pct" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="Alloc %" col="allocation" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="β" col="beta" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortHeader label="α vs SPY" col="alpha" current={sortKey} dir={sortDir} onClick={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr
              key={h.ticker}
              data-testid={`holdings-row-${h.ticker}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                <span data-testid={`holdings-ticker-${h.ticker}`}>{h.ticker}</span>
              </td>
              <td className="px-3 py-2 text-gray-600">
                <span data-testid={`holdings-lots-${h.ticker}`}>{h.lots.length}</span>
              </td>
              <td className="px-3 py-2 text-gray-700">
                <span data-testid={`holdings-invested-${h.ticker}`}>
                  {fmt$(h.total_amount)}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700">
                <span data-testid={`holdings-value-${h.ticker}`}>
                  {fmt$(h.total_current_value)}
                </span>
              </td>
              <td className={`px-3 py-2 ${plColor(h.total_pl_dollars)}`}>
                <span data-testid={`holdings-pl-dollars-${h.ticker}`}>
                  {fmt$(h.total_pl_dollars)}
                </span>
              </td>
              <td className={`px-3 py-2 ${plColor(h.avg_pl_pct)}`}>
                <span data-testid={`holdings-pl-pct-${h.ticker}`}>
                  {fmtPct(h.avg_pl_pct)}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600">
                <span data-testid={`holdings-alloc-${h.ticker}`}>
                  {h.allocation_pct !== null
                    ? `${(h.allocation_pct * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-500">
                <span data-testid={`holdings-beta-${h.ticker}`}>
                  {h.beta !== null ? h.beta.toFixed(2) : '—'}
                </span>
              </td>
              <td className={`px-3 py-2 ${plColor(h.alpha_pct)}`}>
                <span data-testid={`holdings-alpha-${h.ticker}`}>
                  {fmtPct(h.alpha_pct)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
