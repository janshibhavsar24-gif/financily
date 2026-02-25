import { useEffect, useState } from 'react'
import { ApiError, syncTickers } from '../api/client'

const DEFAULT_TICKERS = 'SPY,QQQ,TLT,BND,GLD'

interface Props {
  tickers: string[]
  onSynced?: () => void
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; rowsUpserted: number; latestDate: string }
  | { kind: 'error'; message: string }

export default function SyncButton({ tickers, onSynced }: Props) {
  const [input, setInput] = useState(DEFAULT_TICKERS)
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })

  // Keep input in sync with AssetSelector chips — but only when user hasn't typed
  useEffect(() => {
    if (tickers.length > 0) {
      setInput(tickers.join(','))
    }
  }, [tickers])

  const parsedTickers = input
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0)

  const isSyncing = status.kind === 'syncing'
  const canSync = parsedTickers.length > 0 && !isSyncing

  async function handleSync() {
    if (!canSync) return
    setStatus({ kind: 'syncing' })
    try {
      const res = await syncTickers({ tickers: parsedTickers, lookback_years: 10 })
      setStatus({ kind: 'success', rowsUpserted: res.rows_upserted, latestDate: res.latest_date })
      onSynced?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : 'Sync failed — please try again.'
      setStatus({ kind: 'error', message })
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setStatus({ kind: 'idle' })
        }}
        placeholder="SPY, QQQ, TLT, …"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
      />
      <button
        type="button"
        onClick={handleSync}
        disabled={!canSync}
        className={[
          'w-full px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
          !canSync
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-800 text-white hover:bg-gray-700',
        ].join(' ')}
      >
        {isSyncing ? 'Syncing…' : 'Sync Data'}
      </button>

      {status.kind === 'success' && (
        <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded">
          Synced — {status.rowsUpserted.toLocaleString()} rows, last date {status.latestDate}
        </p>
      )}

      {status.kind === 'error' && (
        <p className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded">{status.message}</p>
      )}
    </div>
  )
}
