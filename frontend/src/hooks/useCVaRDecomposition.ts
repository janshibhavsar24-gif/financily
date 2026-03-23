import { useCallback, useState } from 'react'
import { getCVaRDecomposition } from '../api/client'
import type { CVaRDecompositionResponse } from '../types/api'

interface UseCVaRDecompositionState {
  result: CVaRDecompositionResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseCVaRDecompositionState = {
  result: null,
  loading: false,
  error: null,
}

export function useCVaRDecomposition(): {
  state: UseCVaRDecompositionState
  fetch: (tickers: string[], weights: number[]) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseCVaRDecompositionState>(INITIAL_STATE)

  const fetch = useCallback(async (tickers: string[], weights: number[]) => {
    if (tickers.length === 0) {
      setState(INITIAL_STATE)
      return
    }
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getCVaRDecomposition({ tickers, weights })
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load CVaR decomposition.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
