import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // shadcn/21st.dev components (e.g. src/components/ui/favorites.tsx) are
  // written against the "@/..." import convention. The rest of this app
  // uses plain relative imports and never needed an alias before, so this
  // is added specifically to support that one convention rather than
  // migrating existing code to it.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // maplibre-gl ships its tile-parsing Web Worker as a separate sibling
  // file (maplibre-gl-worker(-dev).mjs), resolved at runtime via
  // `new URL('./maplibre-gl-worker.mjs', import.meta.url)` relative to
  // wherever its own entry module is actually served from. Vite's
  // dependency pre-bundler only copies the entry chunk it can statically
  // discover into node_modules/.vite/deps/ — it has no way to know about
  // that sibling file, so the relocated entry's worker URL 404s once
  // pre-bundled. Symptom in practice: the map's style/sprite/raster
  // sources all load fine (main-thread work), but every vector source
  // (the one that actually needs the worker to parse .pbf tiles) never
  // requests a single tile and never finishes loading — the map stays
  // permanently stuck showing only its flat background color. Excluding
  // it here makes Vite serve it straight from node_modules/maplibre-gl/
  // dist/ instead, where the worker file sits right next to the entry
  // module it's resolved relative to, exactly as published.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
