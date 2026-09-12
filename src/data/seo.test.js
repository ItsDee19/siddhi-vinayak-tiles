import test from 'node:test'
import assert from 'node:assert/strict'
import { business } from './siteConfig.js'
import { products as catalogue } from './catalogue.js'
import { getResponsiveImageProps } from '../utils/responsiveImages.js'
import { policyPages, renderPolicyBody, notFoundPage, renderNotFoundBody } from './policyPages.js'
import {
  PRODUCTION_ORIGIN, policyLinks,
  resolveSiteOrigin, isPreviewBuild, escapeHtml, serializeJsonLd, structuredData,
  renderSeoHead, renderRobots, renderSitemap, cataloguePages,
  cataloguePagePath, productDetailsPath, renderCatalogueBody,
} from './seo.js'

test('canonical origin defaults to the owner-confirmed domain and ignores deployment hosts', () => {
  assert.equal(PRODUCTION_ORIGIN, 'https://sidhhibinayaktiles.com')
  assert.equal(resolveSiteOrigin({}), PRODUCTION_ORIGIN)
  assert.equal(resolveSiteOrigin({ SITE_URL: '   ' }), PRODUCTION_ORIGIN)
  assert.equal(resolveSiteOrigin({ VERCEL_URL: 'ephemeral-deployment.vercel.app' }), PRODUCTION_ORIGIN)
  assert.equal(resolveSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'showroom.vercel.app' }), PRODUCTION_ORIGIN)
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

test('builds without an environment override use the confirmed canonical and social URLs', () => {
  const head = renderSeoHead()
  assert.ok(head.includes(`rel="canonical" href="${PRODUCTION_ORIGIN}/"`))
  assert.ok(head.includes(`property="og:url" content="${PRODUCTION_ORIGIN}/"`))
  assert.ok(head.includes(`property="og:image" content="${PRODUCTION_ORIGIN}/logo-emblem.png"`))
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
  const paths = ['/', ...cataloguePages(Array.from({ length: 25 }, (_, id) => ({ id }))).map(page => page.path), ...policyPages.map(page => page.path)]
  const sitemap = renderSitemap('https://tiles.example', paths)
  assert.equal((sitemap.match(/<loc>/g) || []).length, 5)
  assert.ok(sitemap.includes('<loc>https://tiles.example/catalogue/page/2/</loc>'))
  assert.ok(!sitemap.includes('#'))
  assert.ok(!sitemap.includes('<lastmod>'))
  assert.ok(!sitemap.includes('/404'))
  for (const { href } of policyLinks) assert.ok(sitemap.includes(`<loc>https://tiles.example${href}</loc>`))
  assert.ok(renderRobots('https://tiles.example').includes('Sitemap: https://tiles.example/sitemap.xml'))
})

test('static policies have unique metadata, correct page schema and reciprocal accessible links', () => {
  assert.equal(new Set(policyPages.map(page => page.title)).size, 2)
  assert.equal(new Set(policyPages.map(page => page.description)).size, 2)
  for (const page of policyPages) {
    const head = renderSeoHead(page)
    const body = renderPolicyBody(page)
    assert.ok(head.includes(`<title>${escapeHtml(page.title)}</title>`))
    assert.ok(head.includes(`href="${PRODUCTION_ORIGIN}${page.path}"`))
    assert.equal((body.match(/<h1(?:\s|>)/g) || []).length, 1)
    assert.ok(body.includes('href="#page-content"'))
    assert.ok(body.includes('id="page-content" tabindex="-1"'))
    assert.ok(body.includes('href="/catalogue/"'))
    assert.ok(body.includes(`href="tel:${business.phoneTel}"`))
    for (const { href } of policyLinks) assert.ok(body.includes(`href="${href}"`))
    assert.ok(!body.includes('<script'))
    const schema = structuredData(page)
    assert.ok(schema['@graph'].some(item => item['@type'] === 'WebPage'))
    assert.ok(!schema['@graph'].some(item => item['@type'] === 'CollectionPage'))
    assert.ok(renderSeoHead({ ...page, preview: true }).includes('content="noindex, follow"'))
  }
})

test('policy headings, paragraphs and links are HTML-escaped', () => {
  const value = '<script>"unsafe"&</script>'
  const body = renderPolicyBody({
    heading: value, intro: value,
    sections: [{ heading: value, paragraphs: [value], links: [{ label: value, href: `https://example.com/?q=${value}` }] }],
  })
  assert.ok(body.includes(escapeHtml(value)))
  assert.ok(!body.includes('<script>'))
})

test('404 recovery document is noindex, has no canonical or page schema and keeps navigation usable', () => {
  const head = renderSeoHead(notFoundPage)
  const body = renderNotFoundBody()
  assert.ok(head.includes('content="noindex, follow"'))
  assert.ok(!head.includes('rel="canonical"'))
  assert.ok(!head.includes('property="og:url"'))
  assert.ok(!head.includes('application/ld+json'))
  assert.equal((body.match(/<h1(?:\s|>)/g) || []).length, 1)
  assert.ok(body.includes('href="/"'))
  assert.ok(body.includes('href="/catalogue/"'))
  for (const { href } of policyLinks) assert.ok(body.includes(`href="${href}"`))
})

test('static catalogue shares responsive candidates and native dimensions with interactive images', () => {
  const product = catalogue.find(item => getResponsiveImageProps(item.imageUrl).srcSet)
  assert.ok(product, 'The catalogue should contain generated responsive images')
  const props = getResponsiveImageProps(product.imageUrl)
  const [page] = cataloguePages([product])
  const body = renderCatalogueBody(page)
  assert.ok(body.includes(`srcset="${escapeHtml(props.srcSet)}"`))
  assert.ok(body.includes(`sizes="${escapeHtml(props.sizes)}"`))
  assert.ok(body.includes(`width="${props.width}" height="${props.height}"`))
  assert.ok(body.includes(`src="${escapeHtml(product.imageUrl)}"`))
})
