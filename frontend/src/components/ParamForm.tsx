import type { OptimizeRequest } from '../types/api'

interface Props {
  value: OptimizeRequest
  onChange: (r: OptimizeRequest) => void
  loading: boolean
  onSubmit: () => void
  tickerCount?: number
}

const HORIZONS: Array<2 | 3 | 5> = [2, 3, 5]
const SIM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1000, label: 'Fast' },
  { value: 5000, label: 'Standard' },
  { value: 10000, label: 'Precise' },
]

export default function ParamForm({ value, onChange, loading, onSubmit, tickerCount = 0 }: Props) {
  function update(patch: Partial<OptimizeRequest>) {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="space-y-5">
      {/* Target Return slider */}
      <div>
        <label
          htmlFor="param-target-return"
          className="block text-xs font-semibold text-gray-600 mb-1"
        >
          Target Return:{' '}
          <span className="text-blue-600">{Math.round(value.target_return * 100)}%</span>
        </label>
        <input
          id="param-target-return"
          type="range"
          min={5}
          max={60}
          step={1}
          value={Math.round(value.target_return * 100)}
          onChange={(e) => update({ target_return: Number(e.target.value) / 100 })}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>5%</span>
          <span>60%</span>
        </div>
      </div>

      {/* Horizon buttons */}
      <div>
        <p className="block text-xs font-semibold text-gray-600 mb-1">Investment Horizon</p>
        <div className="flex gap-2">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => update({ horizon_years: h })}
              className={[
                'flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-colors',
                value.horizon_years === h
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400',
              ].join(' ')}
            >
              {h}Y
            </button>
          ))}
        </div>
      </div>

      {/* Max Weight slider */}
      <div>
        <label
          htmlFor="param-max-weight"
          className="block text-xs font-semibold text-gray-600 mb-1"
        >
          Max Position: <span className="text-blue-600">{Math.round(value.max_weight * 100)}%</span>
        </label>
        <input
          id="param-max-weight"
          type="range"
          min={10}
          max={100}
          step={5}
          value={Math.round(value.max_weight * 100)}
          onChange={(e) => update({ max_weight: Number(e.target.value) / 100 })}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>10%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Tax rates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="param-ltcg" className="block text-xs font-semibold text-gray-600 mb-1">
            LTCG Rate (%)
          </label>
          <input
            id="param-ltcg"
            type="number"
            min={0}
            max={40}
            step={1}
            value={Math.round(value.tax_rate_lt * 100)}
            onChange={(e) => update({ tax_rate_lt: Number(e.target.value) / 100 })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="param-stcg" className="block text-xs font-semibold text-gray-600 mb-1">
            STCG Rate (%)
          </label>
          <input
            id="param-stcg"
            type="number"
            min={0}
            max={60}
            step={1}
            value={Math.round(value.tax_rate_st * 100)}
            onChange={(e) => update({ tax_rate_st: Number(e.target.value) / 100 })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Simulations select */}
      <div>
        <label
          htmlFor="param-simulations"
          className="block text-xs font-semibold text-gray-600 mb-1"
        >
          Simulation Quality
        </label>
        <select
          id="param-simulations"
          value={value.n_simulations}
          onChange={(e) => update({ n_simulations: Number(e.target.value) })}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SIM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({opt.value.toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {/* Submit */}
      {tickerCount < 2 && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded text-center">
          {tickerCount === 0 ? 'Select at least 2 assets to run' : 'Select at least 1 more asset'}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || tickerCount < 2}
        className={[
          'w-full py-2.5 text-sm font-bold rounded-lg transition-colors',
          loading || tickerCount < 2
            ? 'bg-blue-300 text-white cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700',
        ].join(' ')}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              aria-hidden={true}
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Optimizing…
          </span>
        ) : (
          'Run Optimizer'
        )}
      </button>
    </div>
  )
}
