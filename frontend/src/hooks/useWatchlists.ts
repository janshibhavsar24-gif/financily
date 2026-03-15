import { useCallback, useEffect, useState } from 'react'
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  renameWatchlist,
} from '../api/client'
import type { WatchlistInfo } from '../types/api'

interface WatchlistsState {
  watchlists: WatchlistInfo[]
  selectedId: string | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: WatchlistsState = {
  watchlists: [],
  selectedId: null,
  loading: false,
  error: null,
}

export function useWatchlists(): {
  state: WatchlistsState
  loadAll: () => Promise<void>
  create: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  select: (id: string) => void
} {
  const [state, setState] = useState<WatchlistsState>(INITIAL_STATE)

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await listWatchlists()
      setState((s) => ({
        ...s,
        watchlists: res.watchlists,
        selectedId: s.selectedId ?? (res.watchlists[0]?.id ?? null),
        loading: false,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load watchlists',
      }))
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const create = useCallback(async (name: string) => {
    const wl = await createWatchlist({ name })
    setState((s) => ({
      ...s,
      watchlists: [...s.watchlists, wl],
      selectedId: wl.id,
    }))
  }, [])

  const rename = useCallback(async (id: string, name: string) => {
    const wl = await renameWatchlist(id, { name })
    setState((s) => ({
      ...s,
      watchlists: s.watchlists.map((w) => (w.id === id ? wl : w)),
    }))
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteWatchlist(id)
    setState((s) => {
      const watchlists = s.watchlists.filter((w) => w.id !== id)
      const selectedId =
        s.selectedId === id ? (watchlists[0]?.id ?? null) : s.selectedId
      return { ...s, watchlists, selectedId }
    })
  }, [])

  const select = useCallback((id: string) => {
    setState((s) => ({ ...s, selectedId: id }))
  }, [])

  return { state, loadAll, create, rename, remove, select }
}
