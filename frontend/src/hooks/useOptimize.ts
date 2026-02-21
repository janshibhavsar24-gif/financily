// useOptimize — custom hook that manages the full optimize request lifecycle.
//
// Exposes: { state, run, reset }
//
// State shape:
//   loading: boolean         — true from the moment run() is called until
//                              the response (success or error) is received
//   result:  OptimizeResponse | null
//   error:   string | null   — human-readable message, rules:
//              • 422 infeasibility → "Target return of X% is not achievable.
//                                     Max achievable: Y%."
//              • 422 missing data  → pass through the FastAPI detail string
//              • any other error   → "An unexpected error occurred."
//
// Rules (see requirement FE-008):
//   - Only one of (loading / result / error) is active at a time.
//   - reset() sets all three back to their initial values so the UI can
//     return to the empty state.
//   - The hook does NOT manage the OptimizeRequest form state — that lives
//     in App.tsx. This hook only owns the async call and its lifecycle.

// TODO: import { useState } from 'react'
// TODO: import { optimizePortfolio } from '../api/client'
// TODO: import { ApiError } from '../api/client'
// TODO: import type { OptimizeRequest, OptimizeResponse } from '../types/api'

// TODO: interface UseOptimizeState {
//   result: OptimizeResponse | null
//   loading: boolean
//   error: string | null
// }

// TODO: export function useOptimize(): {
//   state: UseOptimizeState
//   run: (req: OptimizeRequest) => Promise<void>
//   reset: () => void
// }
//
// Inside run():
//   1. Set loading = true, error = null, result = null
//   2. Call optimizePortfolio(req)
//   3. On success: set result, loading = false
//   4. On ApiError with status 422:
//      - If detail contains InfeasibilityDetail shape → format the
//        "Target return of X% not achievable" message
//      - Otherwise → use detail string directly
//      Set error, loading = false
//   5. On any other error: set generic error message, loading = false
