import type { CorrelationMatrix as CorrelationMatrixType } from '../types/api'

interface Props {
  matrix: CorrelationMatrixType
}

function corrColor(v: number): string {
  // -1 → red (#ef4444), 0 → white (#ffffff), +1 → blue (#3b82f6)
  if (v < 0) {
    const t = Math.abs(v) // 0..1
    const r = Math.round(255 + (239 - 255) * t)
    const g = Math.round(255 + (68 - 255) * t)
    const b = Math.round(255 + (68 - 255) * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = v // 0..1
    const r = Math.round(255 + (59 - 255) * t)
    const g = Math.round(255 + (130 - 255) * t)
    const b = Math.round(255 + (246 - 255) * t)
    return `rgb(${r},${g},${b})`
  }
}

export default function CorrelationMatrix({ matrix }: Props) {
  const { tickers, values } = matrix

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 6px', textAlign: 'left', color: '#6b7280' }} />
            {tickers.map((t) => (
              <th
                key={t}
                style={{
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: '#374151',
                  textAlign: 'center',
                  minWidth: '52px',
                }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowTicker, ri) => (
            <tr key={rowTicker}>
              <td
                style={{
                  padding: '4px 6px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                }}
              >
                {rowTicker}
              </td>
              {tickers.map((colTicker, ci) => {
                const v = ri < values.length && ci < (values[ri]?.length ?? 0) ? values[ri][ci] : 0
                return (
                  <td
                    key={colTicker}
                    data-testid={`corr-cell-${rowTicker}-${colTicker}`}
                    style={{
                      padding: '4px 6px',
                      backgroundColor: corrColor(v),
                      textAlign: 'center',
                      color: Math.abs(v) > 0.5 ? '#111827' : '#374151',
                      fontWeight: ri === ci ? 600 : 400,
                      border: '1px solid #f3f4f6',
                    }}
                  >
                    {v.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: '6px', fontSize: '11px', color: '#9ca3af' }}>
        Based on last 252 trading days · −1 = perfect inverse · +1 = perfect positive
      </p>
    </div>
  )
}
