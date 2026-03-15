import { useCallback, useState } from 'react'
import { getPortfolio } from '../api/client'
import type { PortfolioResponse } from '../types/api'

interface PortfolioState {
  result: PortfolioResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: PortfolioState = {
  result: null,
  loading: false,
  error: null,
}

export function usePortfolio(): {
  state: PortfolioState
  fetch: (watchlistId: string) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<PortfolioState>(INITIAL_STATE)

  const fetch = useCallback(async (watchlistId: string) => {
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getPortfolio(watchlistId)
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load portfolio',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
