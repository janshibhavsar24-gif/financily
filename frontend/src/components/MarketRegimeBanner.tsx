import type { MarketRegimeResponse } from '../types/api'

interface Props {
  regime: MarketRegimeResponse
}

function regimeColor(r: string): string {
  if (r === 'Bull') return 'bg-emerald-100 text-emerald-800 border border-emerald-300'
  if (r === 'Bear') return 'bg-red-100 text-red-800 border border-red-300'
  if (r === 'High-Vol') return 'bg-amber-100 text-amber-800 border border-amber-300'
  return 'bg-gray-100 text-gray-700 border border-gray-300'
}

function yieldColor(s: string): string {
  if (s === 'Normal') return 'bg-blue-100 text-blue-800 border border-blue-300'
  if (s === 'Inverted') return 'bg-red-100 text-red-800 border border-red-300'
  if (s === 'Flat') return 'bg-amber-100 text-amber-800 border border-amber-300'
  return 'bg-gray-100 text-gray-700 border border-gray-300'
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtRate(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

export default function MarketRegimeBanner({ regime }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
      {/* Regime chip */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${regimeColor(regime.regime)}`}>
          {regime.regime}
        </span>
        <span className="text-gray-500 text-xs truncate">{regime.regime_description}</span>
        {regime.realized_vol_30d !== null && (
          <span className="text-xs text-gray-400 whitespace-nowrap">
            30d vol {fmtPct(regime.realized_vol_30d)}
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-gray-300 flex-shrink-0" />

      {/* Yield curve chip */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${yieldColor(regime.yield_status)}`}>
          {regime.yield_status}
        </span>
        {regime.rate_10y !== null && regime.rate_3m !== null && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            10Y {fmtRate(regime.rate_10y)} / 3M {fmtRate(regime.rate_3m)}
          </span>
        )}
      </div>
    </div>
  )
}
