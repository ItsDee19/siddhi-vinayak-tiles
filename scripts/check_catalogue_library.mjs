import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(root, 'public')
const books = JSON.parse(await fs.readFile(path.join(root, 'src/data/catalogueBooks.generated.json'), 'utf8'))
const expectedPages = { 'global-floor': 72, 'global-wall': 76, sky: 73, sunflora: 36 }
const ids = new Set()
let checkedImages = 0
let derivedBytes = 0
let originalBytes = 0

function assetPath(url) {
  assert.match(url, /^\/catalogues\/[a-z0-9/.-]+$/)
  const resolved = path.resolve(publicRoot, `.${url}`)
  assert.ok(resolved.startsWith(`${path.join(publicRoot, 'catalogues')}${path.sep}`))
  return resolved
}

for (const book of books) {
  assert.ok(!ids.has(book.id), `Duplicate catalogue: ${book.id}`)
  ids.add(book.id)
  assert.equal(book.pageCount, expectedPages[book.id], `Source page count changed: ${book.id}`)
  assert.equal(book.pages.length, book.pageCount)
  assert.equal(book.textPageCount, book.pages.filter((page) => page.text.trim()).length)
  assert.ok(book.pages.some((page) => page.number === book.featuredPage))
  assert.equal(book.cover, book.pages[0].image)
  const original = await fs.readFile(assetPath(book.pdfUrl))
  assert.equal(original.subarray(0, 5).toString(), '%PDF-')
  assert.equal(original.length, book.fileSize)
  assert.equal(createHash('sha256').update(original).digest('hex'), book.sourceHash,
    `Original PDF integrity failed: ${book.id}`)
  originalBytes += original.length
  for (const [index, page] of book.pages.entries()) {
    assert.equal(page.number, index + 1, `Missing/out-of-order page: ${book.id}`)
    assert.ok(page.width > 0 && page.height > 0)
    const sourceRatio = page.width / page.height
    for (const kind of ['image', 'detailImage', 'thumbnail']) {
      const filepath = assetPath(page[kind])
      const metadata = await sharp(filepath).metadata()
      assert.equal(metadata.format, 'webp', `${book.id} page ${page.number} ${kind}`)
      // Integer pixel rounding is allowed; cropping or distorted proportions are not.
      assert.ok(Math.abs(metadata.width / metadata.height - sourceRatio) < 0.015,
        `Cropped/distorted page: ${book.id} ${page.number} ${kind}`)
      const maxEdge = kind === 'thumbnail' ? 280 : kind === 'image' ? 1800 : 3600
      assert.ok(Math.max(metadata.width, metadata.height) <= maxEdge)
      if (kind === 'detailImage') {
        assert.equal(metadata.width, page.detailWidth)
        assert.equal(metadata.height, page.detailHeight)
      }
      derivedBytes += (await fs.stat(filepath)).size
      checkedImages += 1
    }
  }
}
assert.deepEqual([...ids].sort(), Object.keys(expectedPages).sort())
console.log(`Catalogue verification passed: ${books.length} original PDFs, ${Object.values(expectedPages).reduce((a, b) => a + b, 0)} complete pages, ${checkedImages} images.`)
console.log(`Original PDFs: ${(originalBytes / 1e6).toFixed(1)} MB; page assets: ${(derivedBytes / 1e6).toFixed(1)} MB. All PDF hashes and uncropped page proportions match.`)
