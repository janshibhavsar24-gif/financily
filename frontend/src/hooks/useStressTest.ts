import { useCallback, useState } from 'react'
import { runStressTest } from '../api/client'
import type { StressTestResponse } from '../types/api'

interface UseStressTestState {
  result: StressTestResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseStressTestState = {
  result: null,
  loading: false,
  error: null,
}

export function useStressTest(): {
  state: UseStressTestState
  fetch: (tickers: string[], weights: number[]) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseStressTestState>(INITIAL_STATE)

  const fetch = useCallback(async (tickers: string[], weights: number[]) => {
    if (tickers.length === 0) {
      setState(INITIAL_STATE)
      return
    }
    setState({ result: null, loading: true, error: null })
    try {
      const result = await runStressTest({ tickers, weights })
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to run stress tests.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
