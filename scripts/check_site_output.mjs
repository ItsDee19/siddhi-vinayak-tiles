// Run after the production build. Checks published documents and real local
// targets, rather than declaring a link healthy because Vite returned SPA HTML.
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PRODUCTION_ORIGIN, siteSeo } from '../src/data/seo.js'
import { business } from '../src/data/siteConfig.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'dist')
const load = file => readFile(path.join(output, file), 'utf8')
const pages = ['index.html', 'privacy-policy/index.html', '404.html']
const documents = await Promise.all(pages.map(load))
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
const attributes = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]))
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map(([text]) => attributes(text))
const expectedAnchors = new Set(['home', 'products', 'visualizer', 'size-calculator', 'about', 'contact', 'privacy-settings'])
let links = 0

async function localFile(pathname) {
  const clean = decodeURIComponent(pathname)
  const location = path.resolve(output, `.${clean}`)
  assert(location === output || location.startsWith(`${output}${path.sep}`), `Outside output: ${pathname}`)
  const data = await stat(location).catch(() => null)
  if (data?.isFile()) return location
  if (data?.isDirectory() && await stat(path.join(location, 'index.html')).catch(() => null)) return path.join(location, 'index.html')
  throw new Error(`Broken local link: ${pathname}`)
}

for (let i = 0; i < documents.length; i++) {
  const html = documents[i]
  const meta = new Map(tags(html, 'meta').map(tag => [tag.name || tag.property, tag.content]))
  const canonical = tags(html, 'link').filter(tag => tag.rel === 'canonical')
  assert.equal((html.match(/<title>/g) || []).length, 1, `${pages[i]} needs one title`)
  assert(meta.get('description')?.length >= 70, `${pages[i]} needs a useful description`)
  assert.equal(meta.get('og:image'), `${PRODUCTION_ORIGIN}${siteSeo.socialImage}`)
  assert.equal(meta.get('twitter:card'), 'summary_large_image')
  assert.equal(meta.get('og:image:width'), '1200')
  assert.equal(meta.get('og:image:height'), '630')
  assert(!/\son(?:load|click|error)\s*=/.test(html), `${pages[i]} contains a CSP-blocked inline event handler`)
  assert(!/fonts\.(?:googleapis|gstatic)\.com/.test(html), `${pages[i]} loads third-party fonts`)
  if (i < 2) {
    const expected = `${PRODUCTION_ORIGIN}${i === 0 ? '/' : '/privacy-policy'}`
    assert.deepEqual(canonical.map(tag => tag.href), [expected])
    assert.equal(meta.get('og:url'), expected)
  } else {
    assert(meta.get('robots').includes('noindex'))
    assert.equal(canonical.length, 0, 'A missing URL must not canonicalize to the home page')
  }
  if (i > 0) assert.equal(tags(html, 'script').length, 0, 'Static documents must not load the catalogue app')
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id))
  for (const tag of [...tags(html, 'a'), ...tags(html, 'link'), ...tags(html, 'img'), ...tags(html, 'script')]) {
    const href = tag.href || tag.src
    if (!href || /^(?:https?:|tel:|mailto:|data:)/.test(href)) continue
    assert.notEqual(href, '#', `Placeholder link in ${pages[i]}`)
    const destination = new URL(href, `${PRODUCTION_ORIGIN}/${pages[i]}`)
    if (href.startsWith('#')) {
      assert(ids.has(destination.hash.slice(1)), `Missing anchor ${href} in ${pages[i]}`)
    } else {
      await localFile(destination.pathname)
      if (destination.pathname === '/' && destination.hash) assert(expectedAnchors.has(destination.hash.slice(1)), `Unknown home anchor: ${href}`)
    }
    links++
  }
}

const structured = JSON.parse(documents[0].match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
const shop = structured['@graph'].find(item => item['@type'] === 'HomeGoodsStore')
assert.equal(shop.telephone, business.phoneTel)
assert.equal(shop.address.postalCode, business.address.pin)
assert.equal(shop.name, business.name)
assert(!JSON.stringify(structured).includes('aggregateRating'))

const image = await sharp(path.join(output, siteSeo.socialImage)).metadata()
assert.equal(image.width, 1200)
assert.equal(image.height, 630)
assert.equal(image.format, 'jpeg')
assert((await stat(path.join(output, siteSeo.socialImage))).size < 200 * 1024, 'Social card exceeds its 200 KB budget')
const sitemap = await load('sitemap.xml')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
assert.deepEqual(urls, [`${PRODUCTION_ORIGIN}/`, `${PRODUCTION_ORIGIN}/privacy-policy`])
for (const url of urls) {
  const { pathname, hash, search } = new URL(url)
  assert.equal(hash + search, '', 'Sitemap must contain canonical pages, not viewer states')
  await localFile(pathname)
}
assert((await load('robots.txt')).includes(`Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`))
const css = await load('site-pages.css')
for (const [, url] of css.matchAll(/url\(["']?(\/[^)"']+)/g)) await localFile(url)
assert(!css.includes('fonts.googleapis.com'))
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'))
assert(!config.rewrites?.some(rule => rule.destination === '/index.html'), 'Catch-all SPA rewrites hide real 404s')
console.log(`Site output verified: ${pages.length} HTML pages, ${links} local references, canonical sitemap, structured data and 1200x630 social card.`)
