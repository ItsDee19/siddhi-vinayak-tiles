import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, loadEnv } from 'vite'
import { products } from '../src/data/catalogue.js'
import {
  resolveSiteOrigin, isPreviewBuild, renderSeoHead, renderSitemap, renderRobots,
  cataloguePages, renderCatalogueBody,
} from '../src/data/seo.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, 'dist')
const environment = { ...loadEnv('production', root, ''), ...process.env }
const origin = resolveSiteOrigin(environment)
const preview = isPreviewBuild(environment)
const indexPath = join(output, 'index.html')
const template = await readFile(indexPath, 'utf8')
if (!template.includes('<!-- SEO:START -->') || !template.includes('<div id="root"></div>')) {
  throw new Error('Run vite build before build_seo; expected a fresh HTML template with SEO markers and an empty root')
}

const vite = await createServer({
  root, mode: 'production', appType: 'custom', logLevel: 'warn',
  server: { middlewareMode: true, hmr: false, watch: null },
})
let markup
try {
  const { render } = await vite.ssrLoadModule('/src/entry-server.jsx')
  markup = await render()
} finally {
  await vite.close()
}
if (!markup.includes('id="contact"') || !markup.includes('id="catalogue"') || !markup.includes('<h1')) {
  throw new Error('Homepage prerender is missing primary content')
}
if (/<script\b/i.test(markup)) throw new Error('Prerender unexpectedly emitted executable streaming scripts')

function withMetadata(html, metadata) {
  return html.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, `<!-- SEO:START -->\n    ${renderSeoHead(metadata)}\n    <!-- SEO:END -->`)
}
const home = withMetadata(template, { origin, preview }).replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${markup}</div>`)
await writeFile(indexPath, home)

const pages = cataloguePages(products)
for (const page of pages) {
  const title = `Tiles & Sanitaryware Catalogue${page.number > 1 ? ` — Page ${page.number}` : ''} | Sidhhi Binayak Tiles`
  const description = `Browse products ${page.start}–${page.end} of ${page.count} in the Sidhhi Binayak Tiles catalogue. Product photographs, sizes and finishes from our Nuapada showroom collection.`
  const head = withMetadata(template, { origin, preview, path: page.path, title, description })
    .match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<script\b(?![^>]*type="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, '')
  const document = `<!doctype html>\n<html lang="en"><head>${head}</head><body>${renderCatalogueBody(page)}</body></html>\n`
  const filename = join(output, page.path.slice(1), 'index.html')
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, document)
}
await writeFile(join(output, 'robots.txt'), renderRobots(origin, preview))
const sitemap = renderSitemap(origin, ['/', ...pages.map(page => page.path)])
if (sitemap) await writeFile(join(output, 'sitemap.xml'), sitemap)
console.log(`Prerendered homepage and ${pages.length} catalogue pages (${products.length} products).`)
console.log(origin ? `Canonical origin: ${origin}; indexing: ${preview ? 'preview noindex' : 'enabled'}.` : 'Canonical origin not configured; absolute metadata and sitemap omitted. Set SITE_URL or VERCEL_PROJECT_PRODUCTION_URL.')
