// AssetSelector — multi-select ticker input with typeahead dropdown.
//
// Props (see requirement FE-005):
//   selected:  string[]                        — currently selected tickers
//   onChange:  (tickers: string[]) => void     — called on add or remove
//
// Behaviour:
//   - On mount: call listAssets() to populate the dropdown options.
//   - Text input: as the user types, filter options by ticker or name
//     (case-insensitive prefix match is sufficient).
//   - Selecting an option adds the ticker to `selected` and clears the input.
//   - Each selected ticker renders as a chip with a remove (×) button.
//     Chip must have data-testid="chip-{TICKER}" (e.g. data-testid="chip-SPY").
//   - If listAssets() returns an empty array, the dropdown shows
//     "No data — sync first" instead of options.
//   - If listAssets() fails, show an inline error message.
//   - A ticker already in `selected` must not appear in the dropdown.
//
// Accessibility:
//   - The text input has aria-label="Search assets" so Playwright can
//     target it with getByRole('textbox', { name: /search assets/i }).
//   - Dropdown options have role="option".

// TODO: import React, { useState, useEffect } from 'react'
// TODO: import { listAssets } from '../api/client'
// TODO: import type { AssetInfo } from '../types/api'

// TODO: interface Props {
//   selected: string[]
//   onChange: (tickers: string[]) => void
// }

// TODO: export default function AssetSelector({ selected, onChange }: Props)
