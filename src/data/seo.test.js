import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCTION_ORIGIN, resolveSiteOrigin, isPreviewBuild, escapeHtml, serializeJsonLd,
  cataloguePath, readerPath, catalogueIndexPages, catalogueMetadata, renderCatalogueBody,
  renderLibraryBody, renderSeoHead, structuredData, renderSitemap, renderRobots,
} from './seo.js'
import { policyPages, notFoundPage, renderNotFoundBody } from './policyPages.js'

const book = {
  id: 'global-floor', title: 'Global Floor Catalogue', description: 'Original floor tile catalogue.',
  format: 'Floor tiles', pdfUrl: '/catalogues/originals/global-floor.pdf', fileSize: 4500000,
  pageCount: 25, cover: '/catalogues/global-floor/cover.webp', featuredPage: 2,
  pages: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, width: 1000, height: 1400,
    image: `/catalogues/global-floor/page-${i + 1}.webp`, thumbnail: `/catalogues/global-floor/thumb-${i + 1}.webp`,
    text: i === 1 ? 'Design AB-123\n600 × 600 mm' : '',
  })),
}

test('canonical origin stays on the owner-confirmed domain, including Vercel previews', () => {
  assert.equal(resolveSiteOrigin(), PRODUCTION_ORIGIN)
  assert.equal(resolveSiteOrigin({ VERCEL_URL: 'preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'old.vercel.app' }), PRODUCTION_ORIGIN)
  assert.equal(resolveSiteOrigin({ SITE_URL: 'https://example.com/' }), 'https://example.com')
  for (const SITE_URL of ['http://example.com', 'https://example.com/a', 'https://user:pass@example.com', 'https://localhost', 'https://127.0.0.1', 'https://example.com/?x=1']) {
    assert.throws(() => resolveSiteOrigin({ SITE_URL }), /HTTPS/)
  }
})

test('catalogue indexes cover every original page once and retain reader references', () => {
  const indexes = catalogueIndexPages(book)
  assert.equal(indexes.length, 3)
  assert.deepEqual(indexes.flatMap(index => index.pages.map(page => page.number)), book.pages.map(page => page.number))
  assert.equal(indexes[1].previous, cataloguePath(book.id))
  assert.equal(indexes[1].next, cataloguePath(book.id, 3))
  assert.equal(indexes[2].end, 25)
  assert.equal(readerPath(book.id, 25), '/?catalogue=global-floor&page=25#catalogue')
  assert.throws(() => catalogueIndexPages(book, 0))
  assert.throws(() => cataloguePath('../unsafe'))
  assert.throws(() => readerPath(book.id, 0))
})

test('static page indexes preserve real text, image and PDF links without inventing specifications', () => {
  const html = renderCatalogueBody(catalogueIndexPages(book)[0])
  assert.match(html, /Design AB-123/)
  assert.match(html, /600 × 600 mm/)
  assert.match(html, /global-floor\.pdf#page=2/)
  assert.match(html, /catalogue=global-floor&amp;page=2#catalogue/)
  assert.match(html, /View the original page to read the printed tile details/)
  assert.match(html, /global-floor\/page\/2\//)
  assert.doesNotMatch(html, /priceCurrency|aggregateRating|placeholder product/i)
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
})

test('library routes lead to the original documents and reader', () => {
  const html = renderLibraryBody([book])
  assert.match(html, /href="\/catalogues\/global-floor\/"/)
  assert.match(html, /catalogue=global-floor&amp;page=2#catalogue/)
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
})

test('metadata is unique for each index with correct canonical and sharing URLs', () => {
  const pages = catalogueIndexPages(book)
  assert.equal(new Set(pages.map(page => catalogueMetadata(page).title)).size, pages.length)
  const html = renderSeoHead(catalogueMetadata(pages[1]))
  assert.match(html, /https:\/\/sidhhibinayaktiles\.com\/catalogues\/global-floor\/page\/2\//)
  assert.match(html, /property="og:image" content="https:\/\/sidhhibinayaktiles\.com\/og-image.jpg"/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.match(html, /index, follow, max-image-preview:large/)
})

test('structured data describes actual business and documents, without fabricated commerce data', () => {
  const data = structuredData({ book, path: cataloguePath(book.id) })
  const store = data['@graph'].find(entity => entity['@type'] === 'HomeGoodsStore')
  assert.equal(store.address.addressLocality, 'Nuapada')
  assert.equal(store.telephone, '+916371255411')
  const document = data['@graph'].find(entity => entity['@type'] === 'DigitalDocument')
  assert.equal(document.encoding.contentUrl, `${PRODUCTION_ORIGIN}${book.pdfUrl}`)
  assert.equal(document.encoding.encodingFormat, 'application/pdf')
  const encoded = JSON.stringify(data)
  for (const forbidden of ['aggregateRating', 'priceCurrency', 'openingHours', 'latitude', 'longitude']) assert.ok(!encoded.includes(forbidden))
  const library = structuredData({ books: [book], path: '/catalogues/' })
  assert.equal(library['@graph'].find(entity => entity['@type'] === 'ItemList').numberOfItems, 1)
})

test('markup treats document text as data and safely serializes JSON-LD', () => {
  assert.equal(escapeHtml('<img onerror="bad()">&'), '&lt;img onerror=&quot;bad()&quot;&gt;&amp;')
  assert.ok(!serializeJsonLd({ name: '</script><script>bad()</script>' }).includes('<'))
  const poisoned = { ...book, title: '<img src=x>', pages: [{ ...book.pages[0], text: '<script>bad()</script>' }] }
  const html = renderCatalogueBody(catalogueIndexPages(poisoned)[0])
  assert.ok(!html.includes('<script>bad()'))
  assert.match(html, /&lt;script&gt;bad/)
})

test('preview metadata excludes indexing while robots allow crawlers to read noindex', () => {
  assert.equal(isPreviewBuild({ VERCEL_ENV: 'preview' }), true)
  assert.equal(isPreviewBuild({ VERCEL_ENV: 'production' }), false)
  assert.match(renderSeoHead({ preview: true }), /noindex, follow/)
  assert.match(renderRobots(PRODUCTION_ORIGIN, true), /Allow: \//)
  assert.doesNotMatch(renderRobots(PRODUCTION_ORIGIN, true), /Sitemap:/)
  assert.match(renderRobots(PRODUCTION_ORIGIN), /Sitemap: https:\/\/sidhhibinayaktiles.com\/sitemap.xml/)
})

test('sitemap includes original PDFs, deduplicates URLs and never uses preview hosts', () => {
  const xml = renderSitemap(PRODUCTION_ORIGIN, ['/', '/catalogues/', book.pdfUrl, '/'])
  assert.equal((xml.match(/<loc>/g) || []).length, 3)
  assert.match(xml, /global-floor.pdf<\/loc>/)
  assert.doesNotMatch(xml, /vercel.app/)
})

test('policies and 404 reflect PDF browsing without obsolete 3D or upload claims', () => {
  const copy = JSON.stringify(policyPages)
  assert.doesNotMatch(copy, /3D visualizer|selected file|saved room|upload that selected/)
  assert.match(copy, /original catalogue pages/)
  const html = renderSeoHead(notFoundPage)
  assert.match(html, /noindex, follow/)
  assert.doesNotMatch(html, /rel="canonical"/)
  assert.match(renderNotFoundBody(), /href="\/catalogues\/"/)
})
