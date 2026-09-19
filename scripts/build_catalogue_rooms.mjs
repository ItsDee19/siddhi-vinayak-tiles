import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { isValidCrop, isValidGeneratedRoom } from '../src/utils/catalogueGallery.js'

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
const sources = await readJson('scripts/catalogue-room-sources.json')
const index = await readJson('src/data/catalogueSearch.generated.json')
const gallery = await readJson('src/data/catalogueGallery.generated.json')
const catalogues = await readJson('scripts/catalogue-sources.json')
const records = new Map(index.records.map(product => [product.id, product]))
const byProduct = {}
const coveredBooks = {}
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
const manifest = JSON.stringify({ version: 1, byProduct }, null, 2) + '\n'
const destination = 'src/data/catalogueRooms.generated.json'
if (process.argv.includes('--check')) {
  assert.equal(await readFile(destination, 'utf8'), manifest, 'Room manifest is stale. Run node scripts/build_catalogue_rooms.mjs')
} else await writeFile(destination, manifest)
console.log(JSON.stringify({ rooms: sources.entries.length, assetsMB: +(totalBytes / 1024 / 1024).toFixed(2), books: coveredBooks }))
