import type { EarningsDate } from '../types/api'

interface Props {
  entries: EarningsDate[]
  portfolioTickers: string[]
}

const TODAY = new Date().toISOString().slice(0, 10)
const WARN_DAYS = 14

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date(TODAY).getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function EarningsCalendar({ entries, portfolioTickers }: Props) {
  const tickerSet = new Set(portfolioTickers)

  const upcoming = entries
    .filter((e) => tickerSet.has(e.ticker) && e.earnings_date >= TODAY)
    .sort((a, b) => a.earnings_date.localeCompare(b.earnings_date))

  if (upcoming.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No upcoming earnings recorded</p>
    )
  }

  return (
    <div className="space-y-2">
      {upcoming.map((e) => {
        const days = daysUntil(e.earnings_date)
        const isNear = days <= WARN_DAYS

        return (
          <div
            key={`${e.ticker}-${e.earnings_date}`}
            data-testid={`earnings-row-${e.ticker}-${e.earnings_date}`}
            className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0"
          >
            <span className="font-mono text-sm font-semibold text-gray-800 w-14 flex-shrink-0">
              {e.ticker}
            </span>
            <span className="text-sm text-gray-600">{e.earnings_date}</span>
            {e.note && (
              <span className="text-xs text-gray-400 flex-1 truncate">{e.note}</span>
            )}
            {isNear && (
              <span className="ml-auto flex-shrink-0 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
