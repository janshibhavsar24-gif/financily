import { useCallback, useState } from 'react'
import { deleteThemeTag, getThemeTags, setThemeTag } from '../api/client'

interface State {
  tags: Record<string, string>
  loading: boolean
  error: string | null
}

const INITIAL_STATE: State = { tags: {}, loading: false, error: null }

export function useThemeTags(): {
  state: State
  load: () => Promise<void>
  setTag: (ticker: string, theme: string) => Promise<void>
  removeTag: (ticker: string) => Promise<void>
} {
  const [state, setState] = useState<State>(INITIAL_STATE)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getThemeTags()
      setState({ tags: res.tags, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load tags',
      }))
    }
  }, [])

  const setTag = useCallback(async (ticker: string, theme: string) => {
    const res = await setThemeTag(ticker, { theme })
    setState((s) => ({ ...s, tags: res.tags }))
  }, [])

  const removeTag = useCallback(async (ticker: string) => {
    await deleteThemeTag(ticker)
    setState((s) => {
      const tags = { ...s.tags }
      delete tags[ticker]
      return { ...s, tags }
    })
  }, [])

  return { state, load, setTag, removeTag }
}
