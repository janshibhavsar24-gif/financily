import { useCallback, useState } from 'react'
import { getWeightDrift } from '../api/client'
import type { DriftResponse } from '../types/api'

interface UseWeightDriftState {
  result: DriftResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseWeightDriftState = {
  result: null,
  loading: false,
  error: null,
}

export function useWeightDrift(): {
  state: UseWeightDriftState
  fetch: (watchlistId: string) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseWeightDriftState>(INITIAL_STATE)

  const fetch = useCallback(async (watchlistId: string) => {
    if (!watchlistId) {
      setState(INITIAL_STATE)
      return
    }
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getWeightDrift(watchlistId)
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load weight drift.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
