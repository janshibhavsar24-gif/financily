import type { AssetForecast } from '../types/api'

interface Props {
  forecasts: Record<string, AssetForecast>
}

export default function ForecastTable({ forecasts }: Props) {
  const sorted = Object.entries(forecasts).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
          Per-asset return forecasts (GARCH + shrinkage)
        </caption>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Ticker</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Exp. Excess Return</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
              Forecast Volatility
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([ticker, forecast]) => (
            <tr key={ticker} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 font-mono font-semibold text-gray-900">{ticker}</td>
              <td className="py-2 px-3 text-right text-gray-700">
                {(forecast.mu * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right text-gray-700">
                {(forecast.sigma * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
