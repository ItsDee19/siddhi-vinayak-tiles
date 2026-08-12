import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Directories that live under public/ purely as INPUTS to the offline asset
// pipeline (scripts/extract_*.py, scripts/build_visualizer_tiles.mjs). Vite
// copies public/ to dist verbatim, so without this they were published:
// 335MB of raw extractions from the supplier catalogues, served at guessable
// URLs, that no page ever requests.
//
// Verified against a running build before adding: the app issues zero requests
// to any of these, resolving every tile through the manifest to
// /assets/catalogue/visualizer_tiles/ instead (see utils/tileSource.js).
//
// They are pruned from the build output rather than moved out of public/,
// because ~20 pipeline scripts reference these paths and the PDFs those
// scripts extract from are no longer in the repo — so a move would break
// tooling that cannot currently be re-run to verify the change.
const BUILD_INPUT_DIRS = [
  'assets/catalogue/swatches',
  'assets/catalogue/clean_swatches',
  'assets/catalogue/clean_swatches_v2',
]

function prunePipelineInputs() {
  return {
    name: 'prune-pipeline-inputs',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve('dist')
      for (const rel of BUILD_INPUT_DIRS) {
        const target = path.join(outDir, rel)
        if (!fs.existsSync(target)) continue
        fs.rmSync(target, { recursive: true, force: true })
        this.info?.(`pruned build-input dir from output: ${rel}`)
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), prunePipelineInputs()],
  build: {
    // Split the heavy 3D libraries into their own chunk so the rest of the
    // site stays light and the 3D canvas can be lazy-loaded.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
