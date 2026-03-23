import { useCallback, useState } from 'react'
import { getMarketRegime } from '../api/client'
import type { MarketRegimeResponse } from '../types/api'

interface UseMarketRegimeState {
  result: MarketRegimeResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseMarketRegimeState = {
  result: null,
  loading: false,
  error: null,
}

export function useMarketRegime(): {
  state: UseMarketRegimeState
  fetch: () => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseMarketRegimeState>(INITIAL_STATE)

  const fetch = useCallback(async () => {
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getMarketRegime()
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load market regime.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
