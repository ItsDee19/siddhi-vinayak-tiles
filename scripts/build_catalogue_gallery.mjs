import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { isValidCrop } from '../src/utils/catalogueGallery.js'

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
const books = await read('src/data/catalogueBooks.generated.json')
const index = await read('src/data/catalogueSearch.generated.json')
const stories = []
const storyIds = new Set()
const mapped = new Set()
for (const book of books) {
  const map = await read(`scripts/catalogue-gallery-map-${book.id}.json`)
  assert.equal(map.bookId, book.id)
  assert.equal(map.sourceHash, book.sourceHash, `${book.id}: verify regions against changed PDF`)
  const records = new Map(index.records.filter(record => record.bookId === book.id).map(record => [record.id, record]))
  for (const story of map.stories) {
    assert(story.id && !storyIds.has(story.id), `Duplicate story ${story.id}`)
    storyIds.add(story.id)
    assert(Number.isInteger(story.pageNumber) && story.pageNumber >= 1 && story.pageNumber <= book.pageCount)
    assert(story.productIds?.length, `No products: ${story.id}`)
    assert(isValidCrop(story.sourceRect) && isValidCrop(story.views?.tile?.rect), `Invalid crop: ${story.id}`)
    for (const view of Object.values(story.views)) {
      assert(isValidCrop(view.rect) && view.label, `Invalid view: ${story.id}`)
      if (view.pageNumber !== undefined) assert(Number.isInteger(view.pageNumber) && view.pageNumber >= 1 && view.pageNumber <= book.pageCount, `Invalid view source page: ${story.id}`)
    }
    for (const id of story.productIds) {
      assert(records.has(id) && !mapped.has(id), `Unknown or duplicate product: ${id}`)
      assert.equal(records.get(id).pageNumber, story.pageNumber, `Wrong original page: ${id}`)
      mapped.add(id)
    }
    stories.push({ ...story, bookId: book.id })
  }
}
assert.equal(mapped.size, index.records.length, 'Every indexed design must have a gallery destination')
const output = JSON.stringify({ stories }) + '\n'
const path = new URL('../src/data/catalogueGallery.generated.json', import.meta.url)
if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), output, 'Regenerate gallery manifest')
else await writeFile(path, output)
console.log(`${stories.length} gallery slides; ${mapped.size} indexed designs; every crop and source mapping validated.`)
