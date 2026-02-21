// SyncButton — triggers data sync for the currently selected tickers.
//
// Props (see requirement FE-006):
//   tickers: string[]    — the tickers to sync (from AssetSelector)
//
// States: idle → syncing → success | error
//
// Behaviour:
//   - Renders a "Sync Data" button.
//   - Disabled when tickers is empty (nothing to sync).
//   - On click: call syncTickers({ tickers, lookback_years: 10 }).
//   - While in flight: button text changes to "Syncing…" and is disabled.
//   - On success: display "Synced — {rows_upserted} rows, last date {latest_date}"
//     as a status message below the button.
//   - On error: display the error detail string in red text below the button.
//   - After success or error the button returns to idle (interactive).
//   - Status message clears when the user clicks Sync again.

// TODO: import React, { useState } from 'react'
// TODO: import { syncTickers } from '../api/client'
// TODO: import { ApiError } from '../api/client'
// TODO: import type { SyncRequest } from '../types/api'

// TODO: interface Props {
//   tickers: string[]
// }

// TODO: export default function SyncButton({ tickers }: Props)
