import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { isValidCrop } from '../src/utils/catalogueGallery.js'

// Rectangles select complete, front-facing tiles from the original publisher
// artwork. No pattern, colour, perspective or dimensions are reconstructed.
// Verified against every SKY (2–73) and Sunflora design page (3–36) on 2026-09-18.
// A small surrounding border protects the tile edges from raster rounding.
const sources = {
  sky: '5babb9322ad8a8da6c2dd4d42fa6db2a0899adfefcd321d260e6d8610f6a40a8',
  sunflora: '731b210443b410598288a861bb7ba6cebeb5958eac926d769cc9b090b034ccf8',
}
const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
const books = await read('src/data/catalogueBooks.generated.json')
const index = await read('src/data/catalogueSearch.generated.json')
const gallery = await read('src/data/catalogueGallery.generated.json')
const byStory = {}
const covered = new Set()

const normalized = (x, y, width, height, pageWidth, pageHeight) =>
  [x / pageWidth, y / pageHeight, width / pageWidth, height / pageHeight].map(value => Number(value.toFixed(7)))

// All SKY source pages have the same 1594 × 3483 detail raster. The four
// publisher layouts below were verified page-by-page; the single-tile and
// two-tile pages must not be assigned the usual three-row coordinates.
const skyCentredPages = new Set([32, 51, 52, 59, 65, 66, 67, 68, 73])
function skyTiles(pageNumber, count) {
  let boxes
  if (pageNumber === 29) {
    boxes = [204, 577, 951, 1333].map(y => [145, y, 475, 321])
    assert.equal(count, 4, 'SKY page 29 has four different complete tiles')
  } else if (pageNumber === 48) {
    boxes = [478, 978].map(y => [84, y, 628, 424])
    assert.equal(count, 2, 'SKY page 48 has two centred complete tiles')
  } else if (skyCentredPages.has(pageNumber)) {
    boxes = [[84, 695, 628, 427]]
    assert.equal(count, 1, `SKY page ${pageNumber} has one centred tile`)
  } else {
    boxes = [204, 698, 1200].map(y => [84, y, 628, 424])
    assert(count === 2 || count === 3, `Unexpected SKY layout on page ${pageNumber}`)
    // Two indexed products indicate the light tile repeats in the last row.
    // The first occurrence shows its entire face and is the selected source.
  }
  return boxes.slice(0, count).map(box => normalized(...box, 1594, 3483))
}

const sunfloraSinglePages = new Set([3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 29, 30, 31, 32, 36])
const sunfloraDoublePages = new Set([4, 11, 18, 19, 20, 21, 22, 24, 25, 26, 27, 33, 34, 35])
// Inclusive vertical bounds measured in the source detail rasters. Pages differ
// slightly even within the same publisher template; explicit bounds avoid both
// clipped tile edges and stray fragments of the nearby printed captions.
const sunfloraRows = {
  3: [[853, 1131]], 4: [[867, 1090], [1174, 1398]],
  5: [[850, 1129]], 6: [[852, 1130]], 7: [[852, 1129]],
  8: [[843, 1121]], 9: [[844, 1121]], 10: [[850, 1129]],
  11: [[864, 1088], [1172, 1396]], 12: [[850, 1129]],
  13: [[844, 1122]], 14: [[844, 1121]], 15: [[848, 1127]],
  16: [[848, 1127]], 17: [[848, 1125]],
  18: [[870, 1095], [1179, 1403]], 19: [[869, 1093], [1177, 1401]],
  20: [[870, 1093], [1177, 1401]], 21: [[870, 1094], [1178, 1402]],
  22: [[870, 1093], [1178, 1401]],
  23: [[1384, 1739], [1873, 2227], [2365, 2720]],
  24: [[1384, 1739], [1873, 2227]], 25: [[1384, 1739], [1872, 2227]],
  26: [[1384, 1739], [1873, 2227]], 27: [[1384, 1739], [1872, 2227]],
  29: [[706, 940]], 30: [[708, 942]], 31: [[709, 944]], 32: [[708, 942]],
  33: [[733, 922], [994, 1182]], 34: [[734, 923], [994, 1182]],
  35: [[737, 925], [998, 1186]], 36: [[726, 960]],
}
function sunfloraTiles(pageNumber, count) {
  const page = books.find(book => book.id === 'sunflora').pages[pageNumber - 1]
  const rectangles = width => sunfloraRows[pageNumber].map(([top, bottom]) =>
    [0.136, Number(((top - 2) / page.detailHeight).toFixed(7)), width, Number(((bottom - top + 5) / page.detailHeight).toFixed(7))])
  if (sunfloraSinglePages.has(pageNumber)) {
    assert.equal(count, 1, `Sunflora page ${pageNumber} has one design with repeated random faces`)
    // Choose the first complete random face; the source board retains all
    // additional random faces, specifications, thickness and printed details.
    return rectangles(0.42)
  }
  if (sunfloraDoublePages.has(pageNumber)) {
    assert.equal(count, 2, `Sunflora page ${pageNumber} has two independently named designs`)
    return rectangles(0.334)
  }
  assert.equal(pageNumber, 23, `Unverified Sunflora page ${pageNumber}`)
  assert.equal(count, 3, 'Sunflora page 23 has three independently named designs')
  return rectangles(0.334)
}

for (const [bookId, sourceHash] of Object.entries(sources)) {
  const book = books.find(item => item.id === bookId)
  assert.equal(book?.sourceHash, sourceHash, `${bookId}: reverify tile rectangles after replacing the source PDF`)
  const records = index.records.filter(record => record.bookId === bookId)
  const stories = gallery.stories.filter(story => story.bookId === bookId)
  for (const story of stories) {
    const products = story.productIds.map(id => records.find(record => record.id === id))
    assert(products.every(Boolean), `Unknown product in ${story.id}`)
    const rects = bookId === 'sky' ? skyTiles(story.pageNumber, products.length) : sunfloraTiles(story.pageNumber, products.length)
    byStory[story.id] = products.map((product, i) => {
      assert.equal(product.pageNumber, story.pageNumber, `Wrong source page for ${product.id}`)
      assert.equal(product.id, `${bookId}-p${story.pageNumber}-d${i + 1}`, `Verify printed product order in ${story.id}`)
      assert(!covered.has(product.id), `Duplicate focus destination for ${product.id}`)
      covered.add(product.id)
      const rect = rects[i]
      assert(isValidCrop(rect), `Invalid complete-tile rectangle for ${product.id}`)
      const page = book.pages[story.pageNumber - 1]
      const ratio = rect[2] * page.width / (rect[3] * page.height)
      assert(Math.abs(ratio - (bookId === 'sky' ? 1.5 : 2)) < 0.08, `Tile proportions changed for ${product.id}`)
      return { productId: product.id, rect, label: product.name }
    })
  }
  assert.equal(records.filter(record => covered.has(record.id)).length, records.length, `Every ${bookId} product must have a verified complete-tile view`)
}

const output = JSON.stringify({ sources, byStory }) + '\n'
const path = new URL('../src/data/catalogueFocus.generated.json', import.meta.url)
if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), output, 'Regenerate catalogue focus views')
else await writeFile(path, output)
console.log(`${Object.keys(byStory).length} verified design boards; ${covered.size} complete-tile views; original artwork and product identities preserved.`)
