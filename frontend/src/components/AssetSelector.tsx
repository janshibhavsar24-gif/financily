import { useEffect, useRef, useState } from 'react'
import { listAssets } from '../api/client'
import type { AssetInfo } from '../types/api'

interface Props {
  selected: string[]
  onChange: (tickers: string[]) => void
}

export default function AssetSelector({ selected, onChange }: Props) {
  const [assets, setAssets] = useState<AssetInfo[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listAssets()
      .then((res) => setAssets(res.assets))
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load assets')
      })
  }, [])

  const filtered = assets.filter(
    (a) =>
      !selected.includes(a.ticker) &&
      (a.ticker.toLowerCase().startsWith(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase())),
  )

  function addTicker(ticker: string) {
    onChange([...selected, ticker])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeTicker(ticker: string) {
    onChange(selected.filter((t) => t !== ticker))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-8">
        {selected.map((ticker) => (
          <span
            key={ticker}
            data-testid={`chip-${ticker}`}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded"
          >
            {ticker}
            <button
              type="button"
              onClick={() => removeTicker(ticker)}
              className="text-blue-600 hover:text-blue-900 leading-none"
              aria-label={`Remove ${ticker}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          aria-label="Search assets"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search ticker or name…"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {open && (
          <ul
            role="listbox"
            className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto"
          >
            {fetchError ? (
              <li className="px-3 py-2 text-sm text-red-600">{fetchError}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                {assets.length === 0 ? 'No data — sync first' : 'No matches'}
              </li>
            ) : (
              filtered.map((asset) => (
                <li
                  key={asset.ticker}
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => addTicker(asset.ticker)}
                  className="flex justify-between px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
                >
                  <span className="font-semibold text-gray-900">{asset.ticker}</span>
                  <span className="text-gray-400 truncate ml-2">{asset.name}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
