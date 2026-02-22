import { useState } from 'react'
import { ApiError, syncTickers } from '../api/client'

interface Props {
  tickers: string[]
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; rowsUpserted: number; latestDate: string }
  | { kind: 'error'; message: string }

export default function SyncButton({ tickers }: Props) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })

  async function handleSync() {
    if (tickers.length === 0) return
    setStatus({ kind: 'syncing' })
    try {
      const res = await syncTickers({ tickers, lookback_years: 10 })
      setStatus({
        kind: 'success',
        rowsUpserted: res.rows_upserted,
        latestDate: res.latest_date,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.detail : 'Sync failed — please try again.'
      setStatus({ kind: 'error', message })
    }
  }

  const isSyncing = status.kind === 'syncing'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={tickers.length === 0 || isSyncing}
        className={[
          'w-full px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
          tickers.length === 0 || isSyncing
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
