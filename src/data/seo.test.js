import test from 'node:test'
import assert from 'node:assert/strict'
import { business } from './siteConfig.js'
import {
  resolveSiteOrigin, isPreviewBuild, escapeHtml, serializeJsonLd, structuredData,
  renderSeoHead, renderRobots, renderSitemap, cataloguePages,
  cataloguePagePath, productDetailsPath, renderCatalogueBody,
} from './seo.js'

test('canonical origin only uses configured production identity', () => {
  assert.equal(resolveSiteOrigin({}), null)
  assert.equal(resolveSiteOrigin({ VERCEL_URL: 'ephemeral-deployment.vercel.app' }), null)
  assert.equal(resolveSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'showroom.vercel.app' }), 'https://showroom.vercel.app')
  assert.equal(resolveSiteOrigin({ SITE_URL: ' https://tiles.example/ ', VERCEL_PROJECT_PRODUCTION_URL: 'showroom.vercel.app' }), 'https://tiles.example')
})

test('canonical origin rejects unsafe, local, or non-origin values', () => {
  for (const value of [
    'javascript:alert(1)', 'http://tiles.example', '//tiles.example',
    'https://user:password@tiles.example', 'https://tiles.example/catalogue',
    'https://tiles.example/?preview=1', 'https://tiles.example/#catalogue',
    'https://tiles.example:444', 'https://localhost', 'https://127.0.0.1',
    'https://shop.localhost',
  ]) assert.throws(() => resolveSiteOrigin({ SITE_URL: value }), /SITE_URL/)
})

test('metadata has one canonical and shares the production URL across cards and schema', () => {
  const head = renderSeoHead({ origin: 'https://tiles.example', path: '/catalogue/page/2/' })
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1)
  assert.ok(head.includes('href="https://tiles.example/catalogue/page/2/"'))
  assert.ok(head.includes('property="og:url" content="https://tiles.example/catalogue/page/2/"'))
  assert.ok(head.includes('property="og:image" content="https://tiles.example/logo-emblem.png"'))
  assert.ok(head.includes('name="robots" content="index, follow, max-image-preview:large"'))
})

test('unconfigured builds do not invent canonical URLs or social image origins', () => {
  const head = renderSeoHead()
  assert.ok(!head.includes('rel="canonical"'))
  assert.ok(!head.includes('property="og:url"'))
  assert.ok(!head.includes('property="og:image"'))
  assert.ok(!head.includes('vercel.app'))
  assert.equal(renderSitemap(null, ['/']), null)
})

test('preview builds remain crawlable to expose noindex and omit sitemap discovery', () => {
  assert.equal(isPreviewBuild({ VERCEL_ENV: 'preview' }), true)
  assert.equal(isPreviewBuild({ VERCEL_ENV: 'development' }), true)
  assert.equal(isPreviewBuild({ VERCEL_ENV: 'production' }), false)
  assert.ok(renderSeoHead({ preview: true }).includes('content="noindex, follow"'))
  const robots = renderRobots('https://tiles.example', true)
  assert.ok(robots.includes('User-agent: *\nAllow: /'))
  assert.ok(!robots.includes('Disallow: /'))
  assert.ok(!robots.includes('Sitemap:'))
})

test('metadata and JSON-LD cannot be broken out by content', () => {
  const malicious = '</title><script>alert("x")</script>&\''
  const head = renderSeoHead({ title: malicious, description: malicious })
  assert.ok(head.includes(escapeHtml(malicious)))
  assert.ok(!head.includes('<script>alert'))
  const json = serializeJsonLd({ name: '</script><script>bad</script>' })
  assert.ok(!json.includes('<'))
  assert.equal(JSON.parse(json).name, '</script><script>bad</script>')
})

test('business structured data reuses visible facts without invented commercial claims', () => {
  const schema = structuredData({ origin: 'https://tiles.example' })
  const store = schema['@graph'].find(item => item['@type'] === 'HomeGoodsStore')
  assert.equal(store.name, business.name)
  assert.equal(store.telephone, business.phoneTel)
  assert.equal(store.address.postalCode, business.address.pin)
  assert.equal(store.address.addressCountry, 'IN')
  for (const property of ['geo', 'aggregateRating', 'review', 'sameAs', 'openingHoursSpecification', 'priceRange', 'offers']) {
    assert.equal(store[property], undefined)
  }
  assert.equal(schema['@graph'].filter(item => item['@type'] === 'WebSite').length, 1)
})

test('catalogue pages form a stable bidirectional graph with every product exactly once', () => {
  const products = Array.from({ length: 55 }, (_, index) => ({ id: `product-${index}` }))
  const pages = cataloguePages(products)
  assert.deepEqual(pages.map(page => page.products.length), [24, 24, 7])
  assert.deepEqual(pages.flatMap(page => page.products), products)
  assert.equal(pages[0].path, '/catalogue/')
  assert.equal(pages[0].previous, null)
  assert.equal(pages[2].next, null)
  assert.equal(pages[0].next, pages[1].path)
  assert.equal(pages[1].previous, pages[0].path)
  assert.equal(pages[2].start, 49)
  assert.equal(pages[2].end, 55)
  assert.throws(() => cataloguePagePath(0))
  assert.throws(() => cataloguePages(products, 0))
})

test('static product records expose real links and safely escaped source fields', () => {
  const [page] = cataloguePages([{
    id: 'sample&x=1', name: '<Basin>', category: 'Sanitaryware',
    size: '455 × 340 mm', finish: 'Matte', imageUrl: 'javascript:alert(1)',
  }])
  const body = renderCatalogueBody(page)
  assert.ok(body.includes(productDetailsPath('sample&x=1')))
  assert.ok(body.includes('&lt;Basin&gt;'))
  assert.ok(body.includes('455 × 340 mm'))
  assert.ok(!body.includes('javascript:'))
  assert.ok(body.includes('aria-label="Catalogue pages"'))
  assert.ok(body.includes('aria-current="page"'))
  assert.ok(!body.includes('<script'))
})

test('sitemap exposes actual pages, with no synthetic lastmod or hash routes', () => {
  const paths = ['/', ...cataloguePages(Array.from({ length: 25 }, (_, id) => ({ id }))).map(page => page.path)]
  const sitemap = renderSitemap('https://tiles.example', paths)
  assert.equal((sitemap.match(/<loc>/g) || []).length, 3)
  assert.ok(sitemap.includes('<loc>https://tiles.example/catalogue/page/2/</loc>'))
  assert.ok(!sitemap.includes('#'))
  assert.ok(!sitemap.includes('<lastmod>'))
  assert.ok(renderRobots('https://tiles.example').includes('Sitemap: https://tiles.example/sitemap.xml'))
})
