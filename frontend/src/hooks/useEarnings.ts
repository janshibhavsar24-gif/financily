import { useCallback, useState } from 'react'
import { addEarningsDate, deleteEarningsDate, getEarnings } from '../api/client'
import type { EarningsDate, EarningsDateRequest } from '../types/api'

interface State {
  entries: EarningsDate[]
  loading: boolean
  error: string | null
}

const INITIAL_STATE: State = { entries: [], loading: false, error: null }

export function useEarnings(): {
  state: State
  load: () => Promise<void>
  add: (req: EarningsDateRequest) => Promise<void>
  remove: (ticker: string, date: string) => Promise<void>
} {
  const [state, setState] = useState<State>(INITIAL_STATE)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getEarnings()
      setState({ entries: res.entries, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load earnings',
      }))
    }
  }, [])

  const add = useCallback(async (req: EarningsDateRequest) => {
    const entry = await addEarningsDate(req)
    setState((s) => ({
      ...s,
      entries: [...s.entries, entry].sort((a, b) =>
        a.earnings_date.localeCompare(b.earnings_date),
      ),
    }))
  }, [])

  const remove = useCallback(async (ticker: string, date: string) => {
    await deleteEarningsDate(ticker, date)
    setState((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) => !(e.ticker === ticker && e.earnings_date === date),
      ),
    }))
  }, [])

  return { state, load, add, remove }
}
