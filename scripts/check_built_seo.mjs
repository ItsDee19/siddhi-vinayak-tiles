import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { products } from '../src/data/catalogue.js'
import { business } from '../src/data/siteConfig.js'
import { cataloguePages, productDetailsPath, escapeHtml, policyLinks } from '../src/data/seo.js'
import { policyPages, notFoundPage } from '../src/data/policyPages.js'
import { getResponsiveImageProps } from '../src/utils/responsiveImages.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const home = await readFile(join(dist, 'index.html'), 'utf8')
assert.ok(home.includes('data-prerendered="true"'), 'Homepage must contain real prerendered HTML')
assert.equal((home.match(/<h1(?:\s|>)/g) || []).length, 1, 'Homepage needs one H1')
for (const id of ['products', 'catalogue', 'about', 'contact']) assert.ok(home.includes(`id="${id}"`), `Missing ${id} content`)
assert.ok(home.includes(business.address.pin))
assert.ok(home.includes(business.phoneTel))
assert.ok(home.includes('href="/catalogue/"'), 'Static catalogue needs a visible homepage link')
for (const { href } of policyLinks) assert.ok(home.includes(`href="${href}"`), `Homepage must link to ${href}`)
assert.ok(!home.includes('<div id="root"></div>'))
assert.ok(!home.includes('<!--$?-->'), 'Unresolved Suspense content must not ship')
const canonical = home.match(/<link rel="canonical" href="([^"]+)"/)
assert.ok(canonical, 'Confirmed production origin must be configured in metadata')
const origin = new URL(canonical[1]).origin
const preview = home.includes('name="robots" content="noindex')
const titles = new Set([home.match(/<title>(.*?)<\/title>/)[1]])
const verifiedAssets = new Set()

async function verifyAsset(path) {
  assert.ok(path.startsWith('/') && !path.startsWith('//') && !path.includes('..') && !path.includes('\\'), `Expected a local asset: ${path}`)
  if (!verifiedAssets.has(path)) {
    await stat(join(dist, path.slice(1)))
    verifiedAssets.add(path)
  }
}

async function verifyStaticDocument(html, path, { noindex = false, canonical = true, schema = true } = {}) {
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path} must have one H1`)
  assert.ok(!/<script\b(?![^>]*type="application\/ld\+json")/i.test(html), 'Static pages must work without executable JS')
  assert.ok(!html.includes('rel="modulepreload"'), 'Static pages must not download the 3D app')
  for (const { href } of policyLinks) assert.ok(html.includes(`href="${href}"`), `${path} must link to ${href}`)
  assert.ok(html.includes('href="/catalogue/"'))
  assert.ok(html.includes('href="/"'))
  const title = html.match(/<title>(.*?)<\/title>/)[1]
  assert.ok(!titles.has(title), `Duplicate title on ${path}`)
  titles.add(title)
  assert.ok(html.includes(`name="robots" content="${preview || noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"`))
  if (canonical) assert.ok(html.includes(`rel="canonical" href="${origin}${path}"`))
  else assert.ok(!html.includes('rel="canonical"'))
  const stylesheets = [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*rel="stylesheet"[^>]*>|<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .map(match => match[1] || match[2]).filter(href => href.startsWith('/assets/'))
  assert.ok(stylesheets.length > 0, 'Static pages must use built CSS')
  for (const asset of stylesheets) await verifyAsset(asset)
  if (schema) {
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
    assert.ok(data['@graph'].some(item => item['@type'] === 'HomeGoodsStore'))
    assert.ok(data['@graph'].some(item => item['@type'] === (path.startsWith('/catalogue/') ? 'CollectionPage' : 'WebPage')))
  } else assert.ok(!html.includes('application/ld+json'))
}

const pages = cataloguePages(products)
const seen = new Set()
for (const page of pages) {
  const html = await readFile(join(dist, page.path.slice(1), 'index.html'), 'utf8')
  await verifyStaticDocument(html, page.path)
  assert.equal((html.match(/<article\b/g) || []).length, page.products.length)
  for (const path of [page.previous, page.next].filter(Boolean)) assert.ok(html.includes(`href="${path}"`))
  for (const product of page.products) {
    assert.ok(html.includes(`href="${escapeHtml(productDetailsPath(product.id))}"`))
    assert.ok(!seen.has(product.id), `Duplicate catalogue record ${product.id}`)
    seen.add(product.id)
    if (product.imageUrl) {
      const props = getResponsiveImageProps(product.imageUrl)
      await verifyAsset(props.src)
      assert.ok(html.includes(`src="${escapeHtml(props.src)}"`))
      if (props.width) assert.ok(html.includes(`width="${props.width}" height="${props.height}"`))
      if (props.srcSet) {
        assert.ok(html.includes(`srcset="${escapeHtml(props.srcSet)}"`))
        assert.ok(html.includes(`sizes="${escapeHtml(props.sizes)}"`))
        for (const candidate of props.srcSet.split(', ')) {
          const match = candidate.match(/^(.*) (\d+)w$/)
          assert.ok(match && Number(match[2]) > 0, `Malformed image candidate ${candidate}`)
          await verifyAsset(match[1])
        }
      }
    }
  }
  const currentLinks = html.match(/aria-current="page"/g) || []
  assert.equal(currentLinks.length, 1)
}
assert.equal(seen.size, products.length)
for (const page of policyPages) {
  const html = await readFile(join(dist, page.path.slice(1), 'index.html'), 'utf8')
  await verifyStaticDocument(html, page.path)
  assert.ok(html.includes(escapeHtml(page.heading)))
  assert.ok(html.includes(business.address.pin))
  assert.ok(html.includes(`href="tel:${business.phoneTel}"`))
}
const notFound = await readFile(join(dist, '404.html'), 'utf8')
await verifyStaticDocument(notFound, notFoundPage.path, { noindex: true, canonical: false, schema: false })
const robots = await readFile(join(dist, 'robots.txt'), 'utf8')
assert.ok(robots.includes('User-agent: *\nAllow: /'))
const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
const indexedPaths = ['/', ...pages.map(page => page.path), ...policyPages.map(page => page.path)]
assert.equal((sitemap.match(/<loc>/g) || []).length, indexedPaths.length)
for (const path of indexedPaths) assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`))
assert.ok(!sitemap.includes('/404'), '404 pages must not appear in the sitemap')
if (preview) assert.ok(!robots.includes('Sitemap:'))
else assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
console.log(`SEO build verified: visible homepage, ${pages.length} linked catalogue pages, ${seen.size} unique products, ${policyPages.length} policy pages, noindex 404 and ${verifiedAssets.size} local image/CSS assets.`)
