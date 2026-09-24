import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { isValidCrop, isValidGeneratedRoom, isValidPublisherRoom } from '../src/utils/catalogueGallery.js'

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
const sources = await readJson('scripts/catalogue-room-sources.json')
const publisherSources = await readJson('scripts/catalogue-publisher-room-sources.json')
const books = await readJson('src/data/catalogueBooks.generated.json')
const index = await readJson('src/data/catalogueSearch.generated.json')
const gallery = await readJson('src/data/catalogueGallery.generated.json')
const catalogues = await readJson('scripts/catalogue-sources.json')
const records = new Map(index.records.map(product => [product.id, product]))
const byProduct = {}
const coveredBooks = {}
const publisherByProduct = {}
const publisherBooks = {}
let totalBytes = 0
for (const entry of sources.entries) {
  const { productId, image, detailImage, width, height, label, provenance } = entry
  const product = records.get(productId)
  assert(product, `Unknown product ${productId}`)
  assert(!byProduct[productId], `Duplicate room for ${productId}`)
  const room = { image, detailImage, width, height, label, provenance }
  assert(isValidGeneratedRoom(room), `Invalid room metadata for ${productId}`)
  assert(entry.generationMode === 'built-in-imagegen' && entry.prompt && entry.qaNotes, `Missing provenance for ${productId}`)
  const book = catalogues.find(book => book.id === product.bookId)
  assert(entry.sourceHash === book.sourceHash && entry.sourcePage === product.pageNumber, `Stale source for ${productId}`)
  assert(entry.sourceImage === `/catalogues/${product.bookId}/page-${String(product.pageNumber).padStart(3, '0')}-detail.webp`, `Wrong source image for ${productId}`)
  assert(isValidCrop(entry.sourceRect), `Invalid source crop for ${productId}`)
  assert(gallery.stories.some(story => story.productIds.includes(productId) && !story.views.room), `Room would replace publisher art for ${productId}`)
  for (const url of [image, detailImage]) {
    assert(new RegExp(`^/catalogue-rooms/${productId}\\.[a-f0-9]{12}-(?:preview|detail)\\.webp$`).test(url), `Unversioned image for ${productId}`)
    const bytes = await readFile(`public${url}`)
    const info = await sharp(bytes).metadata()
    assert(info.format === 'webp', `Invalid WebP for ${productId}`)
    assert(Math.abs(info.width / info.height - width / height) < 0.003, `Distorted image for ${productId}`)
    assert(bytes.length <= (url === image ? 450 : 900) * 1024, `Oversized room asset for ${productId}`)
    if (url === detailImage) assert(info.width === width && info.height === height, `Wrong native dimensions for ${productId}`)
    else assert(Math.max(info.width, info.height) <= 1200, `Oversized preview for ${productId}`)
    totalBytes += bytes.length
  }
  byProduct[productId] = room
  coveredBooks[product.bookId] = (coveredBooks[product.bookId] || 0) + 1
}
assert(publisherSources.version === 1 && Array.isArray(publisherSources.entries), 'Unsupported supplier room source format')
const verifiedPublisherPages = new Set()
for (const entry of publisherSources.entries) {
  const { productId, bookId, sourcePage, sourceRect, label, provenance } = entry
  const product = records.get(productId)
  assert(product && product.bookId === bookId, `Unknown or cross-catalogue supplier product ${productId}`)
  assert(!Object.hasOwn(publisherByProduct, productId) && !Object.hasOwn(byProduct, productId), `Duplicate room for ${productId}`)
  const book = books.find(book => book.id === bookId)
  const sourceBook = catalogues.find(book => book.id === bookId)
  const room = { bookId, pageNumber: sourcePage, rect: sourceRect, label, provenance }
  assert(isValidPublisherRoom(room, book), `Invalid supplier room for ${productId}`)
  assert(entry.sourceHash === sourceBook?.sourceHash && entry.sourceHash === book.sourceHash
    && entry.sourcePdf === sourceBook.sourceName, `Stale supplier source for ${productId}`)
  assert(typeof entry.evidence === 'string' && entry.evidence.trim()
    && typeof entry.confidence === 'string' && entry.confidence.trim(), `Missing supplier match evidence for ${productId}`)
  assert(gallery.stories.some(story => story.bookId === bookId && story.productIds.includes(productId) && !story.views.room),
    `Supplier recovery would replace existing publisher art for ${productId}`)
  const page = book.pages[sourcePage - 1]
  for (const url of [page.image, page.detailImage].filter(Boolean)) {
    if (verifiedPublisherPages.has(url)) continue
    const info = await sharp(await readFile(`public${url}`)).metadata()
    assert(info.format === 'webp' && info.width > 0 && info.height > 0, `Unreadable supplier photograph for ${productId}`)
    assert(Math.abs(info.width / info.height - page.width / page.height) < 0.003, `Distorted supplier page for ${productId}`)
    verifiedPublisherPages.add(url)
  }
  publisherByProduct[productId] = room
  publisherBooks[bookId] = (publisherBooks[bookId] || 0) + 1
}
const manifest = JSON.stringify({ version: 1, byProduct, publisherByProduct }, null, 2) + '\n'
const destination = 'src/data/catalogueRooms.generated.json'
if (process.argv.includes('--check')) {
  assert.equal(await readFile(destination, 'utf8'), manifest, 'Room manifest is stale. Run node scripts/build_catalogue_rooms.mjs')
} else await writeFile(destination, manifest)
console.log(JSON.stringify({ rooms: sources.entries.length, assetsMB: +(totalBytes / 1024 / 1024).toFixed(2), books: coveredBooks, supplierRooms: publisherSources.entries.length, supplierBooks: publisherBooks }))
