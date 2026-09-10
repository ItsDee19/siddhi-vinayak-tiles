import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { products } from '../src/data/catalogue.js'
import { business } from '../src/data/siteConfig.js'
import { cataloguePages, productDetailsPath, escapeHtml } from '../src/data/seo.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const home = await readFile(join(dist, 'index.html'), 'utf8')
assert.ok(home.includes('data-prerendered="true"'), 'Homepage must contain real prerendered HTML')
assert.equal((home.match(/<h1(?:\s|>)/g) || []).length, 1, 'Homepage needs one H1')
for (const id of ['products', 'catalogue', 'about', 'contact']) assert.ok(home.includes(`id="${id}"`), `Missing ${id} content`)
assert.ok(home.includes(business.address.pin))
assert.ok(home.includes(business.phoneTel))
assert.ok(home.includes('href="/catalogue/"'), 'Static catalogue needs a visible homepage link')
assert.ok(!home.includes('<div id="root"></div>'))
assert.ok(!home.includes('<!--$?-->'), 'Unresolved Suspense content must not ship')

const pages = cataloguePages(products)
const seen = new Set()
for (const page of pages) {
  const html = await readFile(join(dist, page.path.slice(1), 'index.html'), 'utf8')
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1)
  assert.equal((html.match(/<article\b/g) || []).length, page.products.length)
  assert.ok(!/<script\b(?![^>]*type="application\/ld\+json")/i.test(html), 'Static catalogue must work without executable JS')
  assert.ok(!html.includes('rel="modulepreload"'), 'Static pages must not download the 3D app')
  for (const path of [page.previous, page.next].filter(Boolean)) assert.ok(html.includes(`href="${path}"`))
  for (const product of page.products) {
    assert.ok(html.includes(`href="${escapeHtml(productDetailsPath(product.id))}"`))
    assert.ok(!seen.has(product.id), `Duplicate catalogue record ${product.id}`)
    seen.add(product.id)
    if (product.imageUrl) await stat(join(root, 'public', product.imageUrl.slice(1)))
  }
  const currentLinks = html.match(/aria-current="page"/g) || []
  assert.equal(currentLinks.length, 1)
  const stylesheets = [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*rel="stylesheet"[^>]*>|<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .map(match => match[1] || match[2]).filter(href => href.startsWith('/assets/'))
  assert.ok(stylesheets.length > 0, 'Static pages must use built CSS')
  for (const path of stylesheets) await stat(join(dist, path.slice(1)))
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  assert.ok(schema['@graph'].some(item => item['@type'] === 'HomeGoodsStore'))
}
assert.equal(seen.size, products.length)
const robots = await readFile(join(dist, 'robots.txt'), 'utf8')
assert.ok(robots.includes('User-agent: *\nAllow: /'))
const canonical = home.match(/<link rel="canonical" href="([^"]+)"/)
if (canonical) {
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
  assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length + 1)
  const origin = new URL(canonical[1]).origin
  for (const path of ['/', ...pages.map(page => page.path)]) assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`))
}
if (home.includes('name="robots" content="noindex')) assert.ok(!robots.includes('Sitemap:'))
console.log(`SEO build verified: visible homepage, ${pages.length} linked catalogue pages, ${seen.size} unique products, metadata and local assets.`)
