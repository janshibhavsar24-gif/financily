import { useCallback, useState } from 'react'
import { getMonitorData } from '../api/client'
import type { MonitorResponse } from '../types/api'

interface UseMonitorState {
  result: MonitorResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseMonitorState = {
  result: null,
  loading: false,
  error: null,
}

export function useMonitor(): {
  state: UseMonitorState
  fetch: (tickers: string[]) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseMonitorState>(INITIAL_STATE)

  const fetch = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setState(INITIAL_STATE)
      return
    }
    setState({ result: null, loading: true, error: null })
    try {
      const result = await getMonitorData(tickers)
      setState({ result, loading: false, error: null })
    } catch (err) {
      setState({
        result: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load monitor data.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, fetch, reset }
}
