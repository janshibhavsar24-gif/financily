import { useCallback, useState } from 'react'
import { getRollingRatios } from '../api/client'
import type { RollingRatiosResponse } from '../types/api'

interface UseRollingRatiosState {
  result: RollingRatiosResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseRollingRatiosState = {
  result: null,
  loading: false,
  error: null,
}

export function useRollingRatios(): {
  state: UseRollingRatiosState
  fetch: (tickers: string[], weights: number[]) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseRollingRatiosState>(INITIAL_STATE)

  const fetch = useCallback(async (tickers: string[], weights: number[]) => {
    if (tickers.length === 0) {
      setState(INITIAL_STATE)
      return
    }
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getRollingRatios(tickers, weights)
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load rolling ratios.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
