// App — root component and two-panel layout.
//
// Layout (see requirement FE-013):
//
//   ┌──────────────┬────────────────────────────────────┐
//   │  Left panel  │         Right panel                │
//   │  (w-80 fixed)│         (flex-1 scrollable)        │
//   │              │                                    │
//   │ AssetSelector│  if loading  → spinner             │
//   │ SyncButton   │  if error    → red error box       │
//   │ ParamForm    │  if result   → WeightsBar          │
//   │              │               MetricsCard          │
//   │ [Run button] │               RiskCostTable        │
//   │              │               ForecastTable        │
//   │              │  else        → empty state text    │
//   └──────────────┴────────────────────────────────────┘
//
// State owned here:
//   selectedTickers: string[]       — driven by AssetSelector
//   optimizeRequest: OptimizeRequest — driven by ParamForm
//   useOptimize() result            — loading / result / error
//
// Rules:
//   - Only one right-panel state is visible at a time (empty / spinner /
//     error / results). See requirement FE-013.
//   - "Run Optimizer" button is disabled while state.loading is true.
//   - selectedTickers is passed to SyncButton so it knows what to sync.

// TODO: import React, { useState } from 'react'
// TODO: import { useOptimize } from './hooks/useOptimize'
// TODO: import AssetSelector from './components/AssetSelector'
// TODO: import SyncButton from './components/SyncButton'
// TODO: import ParamForm from './components/ParamForm'
// TODO: import WeightsBar from './components/WeightsBar'
// TODO: import MetricsCard from './components/MetricsCard'
// TODO: import RiskCostTable from './components/RiskCostTable'
// TODO: import ForecastTable from './components/ForecastTable'
// TODO: import type { OptimizeRequest } from './types/api'

// TODO: default export function App()
