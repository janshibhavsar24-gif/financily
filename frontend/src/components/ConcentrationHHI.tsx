import type { StockMonitor, TickerPL } from '../types/api'

interface Props {
  holdings: TickerPL[]
  stocks: StockMonitor[]
  themeTags: Record<string, string>
}

function computeHHI(weights: number[]): number {
  return weights.reduce((s, w) => s + w * w, 0) * 10000
}

function hhiColor(hhi: number): { bg: string; text: string; label: string } {
  if (hhi < 1500) return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Low' }
  if (hhi <= 2500) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Moderate' }
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'High' }
}

interface HHICardProps {
  label: string
  hhi: number | null
  effectiveN: number | null
  detail: string | null
}

function HHICard({ label, hhi, effectiveN, detail }: HHICardProps) {
  if (hhi === null) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-sm text-gray-400">No data</p>
      </div>
    )
  }

  const { bg, text, label: trafficLabel } = hhiColor(hhi)

  return (
    <div className={`border rounded-lg p-4 ${bg}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold tabular-nums ${text}`}>
          {Math.round(hhi)}
        </span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${text}`}>
          {trafficLabel}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Effective N: <span className="font-medium text-gray-700">{effectiveN?.toFixed(1) ?? '—'}</span>
      </p>
      {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
    </div>
  )
}

export default function ConcentrationHHI({ holdings, stocks, themeTags }: Props) {
  // Position HHI: using allocation_pct (decimal fractions)
  const positionWeights = holdings
    .map((h) => h.allocation_pct ?? 0)
    .filter((w) => w > 0)

  const positionHHI = positionWeights.length > 0 ? computeHHI(positionWeights) : null
  const positionN = positionHHI && positionHHI > 0 ? 10000 / positionHHI : null

  // Sector HHI: aggregate by sector from monitorState stocks
  const sectorByTicker: Record<string, string> = {}
  for (const s of stocks) {
    if (s.sector) sectorByTicker[s.ticker] = s.sector
  }

  const sectorWeights: Record<string, number> = {}
  let totalAlloc = 0
  for (const h of holdings) {
    const alloc = h.allocation_pct ?? 0
    totalAlloc += alloc
    const sector = sectorByTicker[h.ticker] ?? 'Unknown'
    sectorWeights[sector] = (sectorWeights[sector] ?? 0) + alloc
  }

  const sectorWeightList = Object.values(sectorWeights).map((w) =>
    totalAlloc > 0 ? w / totalAlloc : 0
  )
  const sectorHHI = sectorWeightList.length > 0 ? computeHHI(sectorWeightList) : null
  const sectorN = sectorHHI && sectorHHI > 0 ? 10000 / sectorHHI : null
  const sectorCount = Object.keys(sectorWeights).length

  // Theme HHI: group by theme tag, only tagged tickers
  const themeWeights: Record<string, number> = {}
  let themeTotal = 0
  for (const h of holdings) {
    const tag = themeTags[h.ticker]
    if (tag) {
      const alloc = h.allocation_pct ?? 0
      themeWeights[tag] = (themeWeights[tag] ?? 0) + alloc
      themeTotal += alloc
    }
  }

  const themeWeightList = Object.values(themeWeights).map((w) =>
    themeTotal > 0 ? w / themeTotal : 0
  )
  const themeHHI = themeWeightList.length > 1 ? computeHHI(themeWeightList) : null
  const themeN = themeHHI && themeHHI > 0 ? 10000 / themeHHI : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <HHICard
        label="Position HHI"
        hhi={positionHHI}
        effectiveN={positionN}
        detail={`${positionWeights.length} positions`}
      />
      <HHICard
        label="Sector HHI"
        hhi={sectorHHI}
        effectiveN={sectorN}
        detail={`${sectorCount} sector${sectorCount !== 1 ? 's' : ''}`}
      />
      <HHICard
        label="Theme HHI"
        hhi={themeHHI}
        effectiveN={themeN}
        detail={
          themeWeightList.length < 2
            ? 'Tag ≥2 tickers to compute'
            : `${Object.keys(themeWeights).length} themes`
        }
      />
    </div>
  )
}
