import fs from 'node:fs'
import path from 'node:path'

function sendHtml(req, res, file, status) {
  if (!fs.existsSync(file)) return false
  const html = fs.readFileSync(file)
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Length', html.byteLength)
  if (status === 404) res.setHeader('X-Robots-Tag', 'noindex')
  res.end(req.method === 'HEAD' ? undefined : html)
  return true
}

export function staticPageRoutes(directory) {
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next()
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (['/privacy-policy', '/privacy-policy/', '/privacy-policy/index.html'].includes(pathname)) {
      if (sendHtml(req, res, path.join(directory, 'privacy-policy/index.html'), 200)) return
    }
    if (['/404', '/404.html'].includes(pathname)) {
      if (sendHtml(req, res, path.join(directory, '404.html'), 404)) return
    }
    next()
  }
}

export function missingPageRoute(directory, root) {
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !req.headers.accept?.includes('text/html')) return next()
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return next() }
    if (pathname === '/' || /^\/(?:@|src\/|node_modules\/|__vite)/.test(pathname)) return next()
    // Vite's post middleware runs before its index HTML transform. Leave real
    // root HTML entries to Vite, but never rewrite an unknown route to home.
    const candidate = path.resolve(root, `.${pathname}`)
    const relative = path.relative(root, candidate)
    if (!relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next()
    if (!sendHtml(req, res, path.join(directory, '404.html'), 404)) next()
  }
}

export function localSiteRoutes() {
  return {
    name: 'local-static-site-routes',
    configureServer(server) {
      server.middlewares.use(staticPageRoutes(server.config.publicDir))
      return () => server.middlewares.use(missingPageRoute(server.config.publicDir, server.config.root))
    },
    configurePreviewServer(server) {
      const output = path.resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use(staticPageRoutes(output))
      return () => server.middlewares.use(missingPageRoute(output, output))
    },
  }
}
