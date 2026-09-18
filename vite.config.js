import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pruneLegacyPublicAssets } from './scripts/build-public-assets.mjs'
import { localSiteRoutes } from './scripts/local-site-routes.mjs'

export default defineConfig({
  // Keep privacy and missing-page HTTP behavior consistent in local previews.
  appType: 'mpa',
  plugins: [react(), localSiteRoutes(), pruneLegacyPublicAssets()],
  build: {
    manifest: true,
    // Split the heavy 3D libraries into their own chunk so the rest of the
    // site stays light and the 3D canvas can be lazy-loaded.
    //
    // React has to be pinned to its own chunk for that to actually happen.
    // @react-three/fiber depends on React, so listing it here without giving
    // React a home of its own let Rollup pull React *into* the 3D chunk — which
    // meant the entry chunk statically imported three.js just to boot, Vite
    // added a modulepreload for it, and every visitor downloaded the whole 3D
    // stack (~260KB gzipped) before the page could render, whether or not the
    // hero canvas ever mounted.
    rollupOptions: {
      output: {
        // Matched by path rather than by package name so that deep entry points
        // (react/jsx-runtime in particular) land in the React chunk too. Naming
        // just the bare packages left jsx-runtime unassigned, and it fell into
        // the 3D chunk instead — which put three.js back on the critical path.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](three|@react-three)[\\/]/.test(id)) {
            return 'three'
          }
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react'
          }
        },
      },
    },
  },
})
