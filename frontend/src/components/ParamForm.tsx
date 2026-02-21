// ParamForm — form for all portfolio optimization parameters.
//
// Props (see requirement FE-007):
//   value:     OptimizeRequest      — current form state (controlled)
//   onChange:  (r: OptimizeRequest) => void
//   loading:   boolean              — disables the submit button while true
//   onSubmit:  () => void           — called when "Run Optimizer" is clicked
//
// Fields:
//   target_return    range slider   5%–60%, step 1%
//                                   Display label: "Target Return: X%"
//   horizon_years    button group   [2, 3, 5] years — one active at a time
//   max_weight       range slider   10%–100%, step 5%
//                                   Display label: "Max Position: X%"
//   tax_rate_lt      number input   default 15%, label "LTCG Rate (%)"
//   tax_rate_st      number input   default 37%, label "STCG Rate (%)"
//   n_simulations    select         options:
//                                     1000  → label "Fast"
//                                     5000  → label "Standard"
//                                     10000 → label "Precise"
//
// Submit button ("Run Optimizer"):
//   - disabled when loading is true
//   - calls onSubmit() on click
//
// Rules:
//   - Every field change calls onChange with the full updated OptimizeRequest.
//   - No internal submit logic — the parent (App.tsx) calls useOptimize().run().
//   - Slider values are displayed as formatted percentages beside the slider.

// TODO: import React from 'react'
// TODO: import type { OptimizeRequest } from '../types/api'

// TODO: interface Props {
//   value: OptimizeRequest
//   onChange: (r: OptimizeRequest) => void
//   loading: boolean
//   onSubmit: () => void
// }

// TODO: export default function ParamForm({ value, onChange, loading, onSubmit }: Props)
