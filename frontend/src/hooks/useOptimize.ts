import { useCallback, useState } from 'react'
import { ApiError, optimizePortfolio } from '../api/client'
import type { InfeasibilityDetail, OptimizeRequest, OptimizeResponse } from '../types/api'

interface UseOptimizeState {
  result: OptimizeResponse | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: UseOptimizeState = {
  result: null,
  loading: false,
  error: null,
}

export function useOptimize(): {
  state: UseOptimizeState
  run: (req: OptimizeRequest) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<UseOptimizeState>(INITIAL_STATE)

  const run = useCallback(async (req: OptimizeRequest) => {
    setState({ result: null, loading: true, error: null })
    try {
      const result = await optimizePortfolio(req)
      setState({ result, loading: false, error: null })
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        let errorMsg: string
        try {
          const parsed = JSON.parse(err.detail) as unknown
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed) &&
            'error' in parsed &&
            (parsed as InfeasibilityDetail).error === 'infeasible' &&
            'max_achievable' in parsed
          ) {
            // Infeasibility error from the optimizer
            const detail = parsed as InfeasibilityDetail
            const pct = Math.round(detail.max_achievable * 100)
            const targetPct = Math.round(req.target_return * 100)
            errorMsg = `Target return of ${targetPct}% is not achievable. Max achievable: ${pct}%.`
          } else if (Array.isArray(parsed)) {
            // Pydantic validation errors — extract human-readable messages
            const messages = (parsed as Array<{ msg?: string; loc?: string[] }>)
              .map((e) => e.msg ?? 'Validation error')
              .join(', ')
            errorMsg = messages
          } else {
            errorMsg = err.detail
          }
        } catch {
          errorMsg = err.detail
        }
        setState({ result: null, loading: false, error: errorMsg })
      } else {
        setState({ result: null, loading: false, error: 'An unexpected error occurred.' })
      }
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, run, reset }
}
