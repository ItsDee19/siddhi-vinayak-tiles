import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { catalogueIndexPages, cataloguePath, socialImage } from '../src/data/seo.js'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const catalogues = JSON.parse(await readFile(new URL('../src/data/catalogueBooks.generated.json', import.meta.url), 'utf8'))
async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith('.html') ? [join(directory, entry.name)] : []))
  return nested.flat()
}
const files = await htmlFiles(root)
const expected = 5 + catalogues.flatMap(book => catalogueIndexPages(book)).length
assert.equal(files.length, expected, 'Expected home, library, catalogue indexes, two policies and 404')
const titles = new Set()
const canonicalPaths = new Set()
const checkedAssets = new Set()
const pageIds = new Map()
const documents = new Map(await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')])))
for (const [file, html] of documents) pageIds.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])))

for (const [file, html] of documents) {
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: exactly one H1`)
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  assert.ok(title && !titles.has(title), `${file}: unique title required`)
  titles.add(title)
  assert.match(html, /<meta name="description" content="[^"]+"/, `${file}: description`)
  assert.match(html, /property="og:image" content="https:\/\//, `${file}: absolute share image`)
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1]
  if (file.endsWith('404.html')) {
    assert.match(html, /noindex, follow/)
    assert.ok(!canonical, '404 must not canonicalize to an indexable page')
  } else {
    assert.ok(canonical, `${file}: canonical required`)
    canonicalPaths.add(new URL(canonical).pathname)
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1])
  }
  if (file !== join(root, 'index.html')) assert.doesNotMatch(html, /<script[^>]*type="module"|rel="modulepreload"/, `${file}: static pages do not need client JavaScript`)
  // JSON-LD is a non-executable HTML data block. Keep every actual script in
  // same-origin files so script-src 'self' needs no inline exception or nonce.
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/ld\+json"/.test(match[1])) continue
    assert.match(match[1], /\bsrc="\//, `${file}: executable scripts must be same-origin files`)
    assert.equal(match[2].trim(), '', `${file}: no inline executable JavaScript`)
  }
  assert.doesNotMatch(html, /\bon(?:load|error|click)="|href="javascript:/i, `${file}: no inline event handlers`)

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replaceAll('&amp;', '&')
    if (/^(?:https?:|tel:|mailto:|data:|blob:)/i.test(value)) continue
    const base = new URL(`https://local.invalid/${file.slice(root.length).replaceAll('\\', '/')}`)
    const url = new URL(value, base)
    const pathname = decodeURIComponent(url.pathname)
    const target = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`)
    assert.ok(target.startsWith(resolve(root)), `${file}: path outside output`)
    if (!checkedAssets.has(target)) {
      assert.ok((await stat(target)).isFile(), `${file}: missing local target ${value}`)
      checkedAssets.add(target)
    }
    // PDF #page is a native reader fragment, not an HTML element ID.
    if (url.hash && target.endsWith('.html')) assert.ok(pageIds.get(target)?.has(decodeURIComponent(url.hash.slice(1))), `${file}: missing fragment ${value}`)
  }
}
const home = documents.get(join(root, 'index.html'))
assert.match(home, /data-prerendered="true"/, 'Homepage must contain prerendered React markup')
assert.doesNotMatch(home, /Replace this with a real review|A Happy Customer|Your Review Here/, 'No sample reviews')
for (const book of catalogues) {
  assert.match(home, new RegExp(cataloguePath(book.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Homepage links ${book.id} landing`)
  const original = await stat(join(root, book.pdfUrl))
  assert.equal(original.size, book.fileSize, `${book.id}: exact original PDF byte length`)
  if (book.sourceHash) {
    const digest = createHash('sha256').update(await readFile(join(root, book.pdfUrl))).digest('hex')
    assert.equal(digest, book.sourceHash, `${book.id}: original PDF integrity`)
  }
}
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8')
for (const path of [...canonicalPaths, ...catalogues.map(book => book.pdfUrl)]) assert.ok(sitemap.includes(`${path}</loc>`), `Sitemap missing ${path}`)
assert.ok(!sitemap.includes('/404.html'), '404 excluded from sitemap')
assert.match(await readFile(join(root, 'robots.txt'), 'utf8'), /User-agent: \*/)
const image = await sharp(join(root, socialImage.path)).metadata()
assert.equal(image.width, socialImage.width, 'Share image width matches metadata')
assert.equal(image.height, socialImage.height, 'Share image height matches metadata')
console.log(`SEO check passed: ${files.length} HTML pages; unique titles, canonicals, structured data, ${checkedAssets.size} local destinations, all ${catalogues.length} original PDFs and sitemap verified.`)
