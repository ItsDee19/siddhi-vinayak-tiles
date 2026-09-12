import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { initialLoadBudget } from './scripts/vite_initial_load_budget.mjs'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import hostingConfig from './vercel.json'

// https://vitejs.dev/config/
export default defineConfig({
  appType: 'mpa',
  preview: {
    headers: Object.fromEntries(hostingConfig.headers.find(rule => rule.source === '/(.*)').headers.map(({ key, value }) => [key, value])),
  },
  plugins: [react(), initialLoadBudget(), {
    name: 'static-404-preview',
    configurePreviewServer(server) {
      // Match Vercel's filesystem routing during local production checks.
      // Run after static files; an unknown path must not become a homepage 200.
      return () => server.middlewares.use(async (request, response, next) => {
        try {
          const output = resolve(server.config.root, server.config.build.outDir)
          const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
          const requested = resolve(output, `.${pathname}`)
          if (requested === output || requested.startsWith(`${output}${sep}`)) {
            // Vite resolves directory index documents after preview post-hooks.
            const info = await stat(requested).catch(() => null)
            if (info?.isFile()) return next()
            if (info?.isDirectory() && (await stat(resolve(requested, 'index.html')).catch(() => null))?.isFile()) return next()
          }
          const page = await readFile(resolve(output, '404.html'))
          response.statusCode = 404
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(page)
        } catch (error) { next(error) }
      })
    },
  }],
  // Keep Rollup's automatic splitting at the actual lazy component boundaries.
  // A broad manual Three chunk also absorbs shared React dependencies, forcing
  // the entire renderer into the homepage's initial module-preload graph.
})
