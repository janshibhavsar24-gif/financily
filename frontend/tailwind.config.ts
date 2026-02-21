// Tailwind CSS configuration.
//
// The `content` array tells Tailwind which files to scan for class names
// so it can tree-shake unused styles in the production build.
// Must cover index.html and every .ts/.tsx file under src/.
//
// No custom theme extensions are needed for v1 — use Tailwind defaults only.

import type { Config } from 'tailwindcss'

export default {
  content: [
    // TODO: add "./index.html" and "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
