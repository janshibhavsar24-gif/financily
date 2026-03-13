import type { SparkBar } from '../types/api'

interface Props {
  ticker: string
  spark: SparkBar[]
}

const BAR_WIDTH = 4
const BAR_GAP = 1
const CONTAINER_HEIGHT = 40 // px

export default function SparklineBar({ ticker, spark }: Props) {
  if (spark.length === 0) {
    return (
      <div
        data-testid={`sparkline-${ticker}`}
        className="text-xs text-gray-400 italic h-10 flex items-center"
      >
        no data
      </div>
    )
  }

  const maxAbs = spark.reduce((m, b) => Math.max(m, Math.abs(b.ret)), 0) || 0.01
  const halfH = CONTAINER_HEIGHT / 2

  return (
    <div
      data-testid={`sparkline-${ticker}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: `${CONTAINER_HEIGHT}px`,
        gap: `${BAR_GAP}px`,
        position: 'relative',
      }}
    >
      {/* Centre baseline */}
      <div
        style={{
          position: 'absolute',
          top: `${halfH}px`,
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#d1d5db',
          pointerEvents: 'none',
        }}
      />
      {spark.map((bar, i) => {
        const barH = Math.max(1, Math.round((Math.abs(bar.ret) / maxAbs) * halfH))
        const isPos = bar.ret >= 0
        return (
          <div
            key={i}
            style={{
              width: `${BAR_WIDTH}px`,
              height: `${barH}px`,
              backgroundColor: isPos ? '#22c55e' : '#ef4444',
              marginTop: isPos ? `${halfH - barH}px` : `${halfH}px`,
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}
