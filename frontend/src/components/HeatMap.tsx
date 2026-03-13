import type { StockMonitor } from '../types/api'

interface Props {
  stocks: StockMonitor[]
}

function pctColor(pct: number | null): string {
  if (pct === null) return '#f3f4f6'
  const clamped = Math.max(-0.05, Math.min(0.05, pct))
  const t = (clamped + 0.05) / 0.1 // 0 = -5%, 1 = +5%
  if (t < 0.5) {
    // red (#ef4444) → neutral (#f3f4f6)
    const u = t / 0.5
    const r = Math.round(239 + (243 - 239) * u)
    const g = Math.round(68 + (244 - 68) * u)
    const b = Math.round(68 + (246 - 68) * u)
    return `rgb(${r},${g},${b})`
  } else {
    // neutral (#f3f4f6) → green (#22c55e)
    const u = (t - 0.5) / 0.5
    const r = Math.round(243 + (34 - 243) * u)
    const g = Math.round(244 + (197 - 244) * u)
    const b = Math.round(246 + (94 - 246) * u)
    return `rgb(${r},${g},${b})`
  }
}

function textColor(pct: number | null): string {
  if (pct === null) return '#9ca3af'
  const clamped = Math.abs(pct)
  return clamped > 0.015 ? '#111827' : '#374151'
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(2)}%`
}

export default function HeatMap({ stocks }: Props) {
  if (stocks.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: '8px',
      }}
    >
      {stocks.map((s) => (
        <div
          key={s.ticker}
          data-testid={`heatmap-cell-${s.ticker}`}
          style={{
            backgroundColor: pctColor(s.day_pct),
            color: textColor(s.day_pct),
            borderRadius: '8px',
            padding: '10px 8px',
            textAlign: 'center',
            minHeight: '64px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
            {s.ticker}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            {fmtPct(s.day_pct)}
          </span>
        </div>
      ))}
    </div>
  )
}
