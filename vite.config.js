import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// Publish only the assets used by the catalogue website. Legacy visualizer
// source assets remain available to offline tooling without being deployed.
function copyCataloguePublicAssets() {
  let output
  return {
    name: 'copy-catalogue-public-assets',
    apply: 'build',
    configResolved(config) {
      output = path.resolve(config.root, config.build.outDir)
      const relative = path.relative(root, output)
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Build output must be inside the project')
    },
    closeBundle() {
      const publicDir = path.join(root, 'public')
      const assets = fs.readdirSync(publicDir, { withFileTypes: true })
        .filter(entry => entry.isFile()).map(entry => entry.name)
      assets.push('catalogues', 'assets/catalogue/gt-floor-c001.webp')
      for (const relative of assets) {
        const destination = path.resolve(output, relative)
        if (!destination.startsWith(output + path.sep)) throw new Error('Invalid public asset output path')
        fs.mkdirSync(path.dirname(destination), { recursive: true })
        fs.cpSync(path.join(publicDir, relative), destination, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyCataloguePublicAssets()],
  build: {
    copyPublicDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
        },
      },
    },
  },
})
