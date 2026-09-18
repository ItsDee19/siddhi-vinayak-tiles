import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gallerySelection, galleryPath, galleryViewPage, cropViewBox, isValidCrop } from './catalogueGallery.js'

const books = [
  { id: 'floor', pageCount: 12, featuredPage: 3 },
  { id: 'wall', pageCount: 9, featuredPage: 4 },
]
const stories = [
  { id: 'floor-p3-left', bookId: 'floor', pageNumber: 3, productIds: ['floor-p3-light', 'floor-p3-dark'] },
  { id: 'floor-p3-right', bookId: 'floor', pageNumber: 3, productIds: ['floor-p3-green'] },
  { id: 'floor-p8', bookId: 'floor', pageNumber: 8, productIds: ['floor-p8-grey'] },
  { id: 'wall-p4', bookId: 'wall', pageNumber: 4, productIds: ['wall-p4-decor'] },
]

test('old catalogue links select the first design on that original page', () => {
  assert.deepEqual(gallerySelection('', books, stories), {
    bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', mode: 'gallery',
  })
  assert.deepEqual(gallerySelection('?catalogue=wall', books, stories), {
    bookId: 'wall', pageNumber: 4, storyId: 'wall-p4', mode: 'gallery',
  })
})

test('a shared design opens the exact story and its authoritative page within its collection', () => {
  assert.deepEqual(gallerySelection('?catalogue=floor&page=3&design=floor-p3-right', books, stories), {
    bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-right', mode: 'gallery',
  })
  // A stale page parameter must not make the share link show a different design.
  assert.deepEqual(gallerySelection('?catalogue=floor&page=3&design=floor-p8', books, stories), {
    bookId: 'floor', pageNumber: 8, storyId: 'floor-p8', mode: 'gallery',
  })
})

test('unknown or cross-collection design IDs cannot select another collection’s imagery', () => {
  for (const design of ['missing', 'wall-p4', '<script>']) {
    const search = new URLSearchParams({ catalogue: 'floor', page: '3', design })
    assert.deepEqual(gallerySelection(search.toString(), books, stories), {
      bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', mode: 'gallery',
    })
  }
})

test('covers, excluded pages and empty story lists remain reachable in original-page mode', () => {
  assert.deepEqual(gallerySelection('?catalogue=wall&page=1', books, stories), {
    bookId: 'wall', pageNumber: 1, storyId: null, mode: 'page',
  })
  assert.deepEqual(gallerySelection('?catalogue=wall&page=9999', books, stories), {
    bookId: 'wall', pageNumber: 9, storyId: null, mode: 'page',
  })
  assert.deepEqual(gallerySelection('?catalogue=wall&page=4', books, []), {
    bookId: 'wall', pageNumber: 4, storyId: null, mode: 'page',
  })
})

test('original-page mode preserves its selected design so both views can be shared', () => {
  for (const mode of ['gallery', 'page']) {
    const selection = { bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-right', mode }
    const url = new URL(galleryPath(selection), 'https://example.test')
    assert.equal(url.pathname, '/')
    assert.equal(url.hash, '#visualizer')
    assert.equal(url.searchParams.get('view'), mode === 'page' ? 'page' : null)
    assert.deepEqual(gallerySelection(url.search, books, stories), selection)
  }
  const sourceOnly = { bookId: 'wall', pageNumber: 1, storyId: null, mode: 'page' }
  const url = new URL(galleryPath(sourceOnly), 'https://example.test')
  assert.equal(url.searchParams.has('design'), false)
  assert.deepEqual(gallerySelection(url.search, books, stories), sourceOnly)
})

test('a shared variant preserves the exact product in both focused and original-page views', () => {
  for (const mode of ['gallery', 'page']) {
    const selection = { bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', productId: 'floor-p3-dark', mode }
    const url = new URL(galleryPath(selection), 'https://example.test')
    assert.equal(url.searchParams.get('product'), 'floor-p3-dark')
    assert.deepEqual(gallerySelection(url.search, books, stories), selection)
  }
  assert.deepEqual(gallerySelection('?catalogue=floor&page=8&design=floor-p3-left&product=floor-p3-dark', books, stories), {
    bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', productId: 'floor-p3-dark', mode: 'gallery',
  })
})

test('a product URL cannot select a sibling design, another page or another collection', () => {
  for (const product of ['floor-p3-green', 'floor-p8-grey', 'wall-p4-decor', 'missing', '<script>', '']) {
    const search = new URLSearchParams({ catalogue: 'floor', page: '3', design: 'floor-p3-left', product })
    const restored = gallerySelection(search.toString(), books, stories)
    assert.deepEqual(restored, { bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', mode: 'gallery' })
    assert.equal(new URL(galleryPath(restored), 'https://example.test').searchParams.has('product'), false)
  }
  assert.deepEqual(gallerySelection('?catalogue=wall&page=1&product=wall-p4-decor', books, stories), {
    bookId: 'wall', pageNumber: 1, storyId: null, mode: 'page',
  })
})

test('old design links remain variant-neutral and valid legacy page links may name an in-story product', () => {
  const legacy = gallerySelection('?catalogue=floor&page=3', books, stories)
  assert.equal(Object.hasOwn(legacy, 'productId'), false)
  assert.equal(new URL(galleryPath(legacy), 'https://example.test').searchParams.has('product'), false)
  assert.deepEqual(gallerySelection('?catalogue=floor&page=3&product=floor-p3-dark', books, stories), {
    bookId: 'floor', pageNumber: 3, storyId: 'floor-p3-left', productId: 'floor-p3-dark', mode: 'gallery',
  })
})

test('every published focus sample shares back to its exact product and source page', () => {
  const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const realBooks = json('../data/catalogueBooks.generated.json')
  const realStories = json('../data/catalogueGallery.generated.json').stories
  const focus = json('../data/catalogueFocus.generated.json').byStory
  for (const [storyId, samples] of Object.entries(focus)) {
    const story = realStories.find(item => item.id === storyId)
    assert.ok(story, `Missing story for focused samples: ${storyId}`)
    for (const sample of samples) {
      const selection = { bookId: story.bookId, pageNumber: story.pageNumber, storyId, productId: sample.productId, mode: 'gallery' }
      const url = new URL(galleryPath(selection), 'https://example.test')
      assert.deepEqual(gallerySelection(url.search, realBooks, realStories), selection, sample.productId)
    }
  }
})

test('gallery share links encode identifiers without introducing query parameters', () => {
  const selection = { bookId: 'floor & wall/#?', pageNumber: 8, storyId: 'design & view=page/#?', productId: 'variant & catalogue=wall/#?', mode: 'gallery' }
  const url = new URL(galleryPath(selection), 'https://example.test')
  assert.equal(url.searchParams.get('catalogue'), selection.bookId)
  assert.equal(url.searchParams.get('design'), selection.storyId)
  assert.equal(url.searchParams.get('product'), selection.productId)
  assert.deepEqual([...url.searchParams.keys()], ['catalogue', 'page', 'design', 'product'])
  assert.equal(url.hash, '#visualizer')
})

test('normalized crops convert each axis against its original page dimensions without stretching', () => {
  const spread = { width: 3304, height: 2336 }
  assert.deepEqual(cropViewBox(spread, [0.5, 0, 0.5, 1]), [1652, 0, 1652, 2336])
  assert.deepEqual(cropViewBox({ width: 1594, height: 3483 }, [0, 0.5, 1, 0.5]), [0, 1741.5, 1594, 1741.5])
  const rect = Object.freeze([0.12, 0.438, 0.78, 0.335])
  const page = Object.freeze({ width: 1335, height: 1889 })
  const [x, y, width, height] = cropViewBox(page, rect)
  assert.ok(Math.abs(x / page.width - rect[0]) < 1e-12)
  assert.ok(Math.abs(y / page.height - rect[1]) < 1e-12)
  assert.ok(Math.abs(width / height - (rect[2] * page.width) / (rect[3] * page.height)) < 1e-12)
  assert.deepEqual(rect, [0.12, 0.438, 0.78, 0.335])
})

test('a room on a separate PDF page uses its own source image and geometry', () => {
  const tile = { number: 1, width: 600, height: 900, image: '/tile.webp' }
  const room = { number: 2, width: 1200, height: 800, image: '/room.webp' }
  const story = { page: tile, book: { pages: [tile, room] }, views: {
    tile: { rect: [0, 0, 1, 1] }, room: { pageNumber: 2, rect: [0.1, 0.2, 0.8, 0.7] },
  } }
  assert.equal(galleryViewPage(story, 'tile'), tile)
  assert.equal(galleryViewPage(story, 'room'), room)
  assert.deepEqual(cropViewBox(galleryViewPage(story, 'room'), story.views.room.rect), [120, 160, 960, 560])
  assert.equal(galleryViewPage(story, 'missing'), null)
  assert.equal(galleryViewPage({ ...story, views: { room: { pageNumber: 99 } } }, 'room'), null)
  assert.equal(galleryViewPage({ ...story, views: { room: { rect: [0, 0, 1, 1] } } }, 'room'), tile)
})

test('every catalogue product has an exact shareable gallery destination and valid view sources', () => {
  const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const realBooks = json('../data/catalogueBooks.generated.json')
  const realStories = json('../data/catalogueGallery.generated.json').stories
  const records = json('../data/catalogueSearch.generated.json').records
  const mapped = new Map()
  for (const story of realStories) {
    const book = realBooks.find(item => item.id === story.bookId)
    const resolved = { ...story, book, page: book.pages[story.pageNumber - 1] }
    for (const [kind, view] of Object.entries(story.views)) {
      const source = galleryViewPage(resolved, kind)
      assert.ok(source?.image, `${story.id}/${kind}: missing original page`)
      assert.equal(source.number, view.pageNumber ?? story.pageNumber)
      assert.ok(isValidCrop(view.rect), `${story.id}/${kind}: incomplete crop`)
    }
    for (const productId of story.productIds) {
      assert.equal(mapped.has(productId), false, `Duplicate ${productId}`)
      mapped.set(productId, story)
      const selection = { bookId: story.bookId, pageNumber: story.pageNumber, storyId: story.id, productId, mode: 'gallery' }
      const url = new URL(galleryPath(selection), 'https://example.test')
      assert.deepEqual(gallerySelection(url.search, realBooks, realStories), selection)
    }
  }
  assert.equal(mapped.size, records.length)
  for (const record of records) {
    assert.equal(mapped.get(record.id)?.bookId, record.bookId)
    assert.equal(mapped.get(record.id)?.pageNumber, record.pageNumber)
  }
})

test('crop validation permits full-page boundaries and harmless floating-point rounding', () => {
  for (const rect of [[0, 0, 1, 1], [0.5, 0, 0.5, 1], [0.12, 0.438, 0.78, 0.495], [0.1, 0, 0.9000000000000001, 1]]) {
    assert.equal(isValidCrop(rect), true, JSON.stringify(rect))
  }
})

test('malformed, empty, non-finite and out-of-page crops are rejected before rendering', () => {
  for (const rect of [null, {}, '0,0,1,1', [], [0, 0, 1], [0, 0, 1, 1, 0],
    ['0', 0, 1, 1], [0, 0, NaN, 1], [0, 0, 1, Infinity],
    [-0.1, 0, 1, 1], [0, -0.1, 1, 1], [0, 0, 0, 1], [0, 0, 1, -1],
    [0.9, 0, 0.2, 1], [0, 0.9, 1, 0.2]]) {
    assert.equal(isValidCrop(rect), false, JSON.stringify(rect))
  }
})
