// Vite configuration for the Financily frontend.
//
// Two responsibilities:
//   1. Register the React plugin so JSX/TSX is transformed correctly.
//   2. Proxy all /api/* requests from the Vite dev server (localhost:5173)
//      to the FastAPI backend (localhost:8000) so the browser never sees
//      a CORS error during development.
//
// In production this file is not used — FastAPI serves the built dist/
// directly and handles /api/* itself.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // TODO: add react() plugin here
  ],
  server: {
    proxy: {
      // TODO: proxy /api to http://localhost:8000
    },
  },
})
