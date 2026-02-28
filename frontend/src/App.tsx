import { useState } from 'react'
import AssetSelector from './components/AssetSelector'
import DueDiligencePage from './components/DueDiligencePage'
import ForecastTable from './components/ForecastTable'
import MetricsCard from './components/MetricsCard'
import ParamForm from './components/ParamForm'
import RiskCostTable from './components/RiskCostTable'
import SyncButton from './components/SyncButton'
import WeightsBar from './components/WeightsBar'
import { useOptimize } from './hooks/useOptimize'
import type { OptimizeRequest } from './types/api'

type ActiveView = 'optimizer' | 'due-diligence'

const DEFAULT_REQUEST: OptimizeRequest = {
  tickers: [],
  target_return: 0.12,
  horizon_years: 3,
  max_weight: 0.4,
  tax_rate_lt: 0.15,
  tax_rate_st: 0.37,
  n_simulations: 5000,
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('optimizer')
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [params, setParams] = useState<OptimizeRequest>(DEFAULT_REQUEST)
  const { state, run, reset } = useOptimize()

  function handleSubmit() {
    if (selectedTickers.length < 2) return
    run({ ...params, tickers: selectedTickers })
  }

  function handleParamsChange(updated: OptimizeRequest) {
    setParams(updated)
    if (state.result !== null || state.error !== null) {
      reset()
    }
  }

  function handleTickersChange(tickers: string[]) {
    setSelectedTickers(tickers)
    if (state.result !== null || state.error !== null) {
      reset()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Top nav bar */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-5 h-12 gap-6">
        <span className="text-sm font-bold text-gray-900 mr-2">Financily</span>
        <button
          type="button"
          onClick={() => setActiveView('optimizer')}
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            activeView === 'optimizer'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Optimizer
        </button>
        <button
          type="button"
          onClick={() => setActiveView('due-diligence')}
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            activeView === 'due-diligence'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Due Diligence
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {activeView === 'optimizer' && (
          <>
            {/* Left panel */}
            <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-500">Portfolio Risk Engine</p>
              </div>

              <div className="flex-1 px-5 py-4 space-y-6">
                <section>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Assets
                  </h2>
                  <AssetSelector selected={selectedTickers} onChange={handleTickersChange} />
                </section>

                <section>
                  <SyncButton tickers={selectedTickers} />
                </section>

                <section>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Parameters
                  </h2>
                  <ParamForm
                    value={{ ...params, tickers: selectedTickers }}
                    onChange={handleParamsChange}
                    loading={state.loading}
                    onSubmit={handleSubmit}
                    tickerCount={selectedTickers.length}
                  />
                </section>
              </div>
            </aside>

            {/* Right panel */}
            <main className="flex-1 overflow-y-auto px-8 py-6">
              {state.loading && (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center space-y-3">
                    <svg
                      aria-hidden={true}
                      className="animate-spin h-10 w-10 text-blue-600 mx-auto"
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
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">Running optimizer…</p>
                  </div>
                </div>
              )}

              {!state.loading && state.error !== null && (
                <div className="max-w-xl mx-auto mt-16">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
                    <p className="text-sm font-semibold text-red-700 mb-1">Optimization failed</p>
                    <p className="text-sm text-red-600">{state.error}</p>
                    <button
                      type="button"
                      onClick={reset}
                      className="mt-3 text-xs text-red-700 underline hover:no-underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {!state.loading && state.result !== null && (
                <div className="space-y-8 max-w-4xl">
                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-3">Optimal Weights</h2>
                    <WeightsBar weights={state.result.optimal_portfolio.weights} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-3">Portfolio Metrics</h2>
                    <MetricsCard metrics={state.result.optimal_portfolio} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-3">Efficient Frontier</h2>
                    <RiskCostTable
                      rows={state.result.risk_cost_table}
                      targetReturn={params.target_return}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-gray-800 mb-3">Asset Forecasts</h2>
                    <ForecastTable forecasts={state.result.forecasts} />
                  </div>
                </div>
              )}

              {!state.loading && state.result === null && state.error === null && (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center space-y-2">
                    <p className="text-gray-400 text-sm">
                      Select assets, set your target return, and click{' '}
                      <span className="font-semibold text-blue-600">Run Optimizer</span>.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </>
        )}

        {activeView === 'due-diligence' && <DueDiligencePage />}
      </div>
    </div>
  )
}
