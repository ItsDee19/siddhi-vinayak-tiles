import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gallerySelection, galleryPath, galleryViewPage, galleryFallbackPdfPage, galleryProductId, galleryRoomView, isValidGeneratedRoom, isValidPublisherRoom, matchingGallerySources, cropViewBox, isValidCrop } from './catalogueGallery.js'

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

const aiRoom = { image: '/catalogue-rooms/light.a123.preview.webp', detailImage: '/catalogue-rooms/light.a123.detail.webp',
  width: 2400, height: 1600, label: 'AI room preview', provenance: 'ai-generated' }
const aiRooms = { version: 1, byProduct: { light: aiRoom,
  dark: { ...aiRoom, image: '/catalogue-rooms/dark.b456.preview.webp', detailImage: '/catalogue-rooms/dark.b456.detail.webp' } } }
const roomlessStory = { id: 'board', productIds: ['light', 'dark'], pageNumber: 7,
  page: { number: 7, width: 600, height: 900, image: '/catalogues/tile-page.webp' },
  views: { tile: { rect: [.1, .1, .8, .8], label: 'Tile board' } } }

test('default room selection uses a verified focus or an unambiguous product, never an arbitrary sibling', () => {
  assert.equal(galleryProductId(roomlessStory, 'dark', [{ productId: 'light' }]), 'dark')
  assert.equal(galleryProductId(roomlessStory, null, [{ productId: 'other-book' }, { productId: 'light' }]), 'light')
  assert.equal(galleryProductId(roomlessStory, 'other-book'), null)
  assert.equal(galleryProductId({ ...roomlessStory, productIds: ['light'] }), 'light')
  assert.equal(galleryProductId(undefined), null)
})

test('generated rooms match the exact selected product and retain independent geometry without PDF metadata', () => {
  const scene = galleryRoomView(roomlessStory, 'dark', aiRooms)
  assert.equal(scene.page.image, aiRooms.byProduct.dark.image)
  assert.equal(scene.productId, 'dark')
  assert.equal(scene.provenance, 'ai-generated')
  assert.equal(scene.view.label, 'AI room preview')
  assert.deepEqual(cropViewBox(scene.page, scene.view.rect), [0, 0, 2400, 1600])
  assert.equal(Object.hasOwn(scene.page, 'number'), false)
  assert.equal(Object.hasOwn(scene.view, 'pageNumber'), false)
  assert.equal(galleryViewPage(roomlessStory, 'tile').number, 7)
  assert.equal(galleryViewPage(roomlessStory, 'room'), null)
  for (const id of [null, undefined, 'not-in-board', 'toString']) assert.equal(galleryRoomView(roomlessStory, id, aiRooms), null)
  assert.equal(galleryRoomView(roomlessStory, 'dark', { version: 1, byProduct: { light: aiRoom } }), null)
  assert.equal(galleryRoomView(roomlessStory, 'light', { ...aiRooms, version: 2 }), null)
})

test('publisher rooms take priority without changing their PDF page, crop, or labels', () => {
  const printedRoom = { rect: [.2, .3, .6, .5], label: 'Installed design' }
  const story = { ...roomlessStory, views: { ...roomlessStory.views, room: printedRoom } }
  const result = galleryRoomView(story, 'light', aiRooms)
  assert.equal(result.provenance, 'publisher')
  assert.equal(result.view, printedRoom)
  assert.equal(result.page, roomlessStory.page)
  assert.equal(result.page.number, 7)
})

test('generated metadata rejects remote paths, traversal, invalid dimensions, and missing provenance', () => {
  assert.equal(isValidGeneratedRoom(aiRoom), true)
  assert.equal(isValidGeneratedRoom({ ...aiRoom, detailImage: undefined }), true)
  for (const room of [null, {}, { ...aiRoom, image: 'https://example.test/a.webp' },
    { ...aiRoom, image: '/catalogue-rooms/../private.webp' }, { ...aiRoom, image: '/catalogue-rooms/a.svg' },
    { ...aiRoom, detailImage: '//example.test/a.webp' }, { ...aiRoom, width: 0 },
    { ...aiRoom, height: Infinity }, { ...aiRoom, width: 100.5 }, { ...aiRoom, height: 20000 },
    { ...aiRoom, label: 'Publisher photo' }, { ...aiRoom, provenance: 'publisher' }]) {
    assert.equal(isValidGeneratedRoom(room), false, JSON.stringify(room))
    assert.equal(galleryRoomView(roomlessStory, 'light', { version: 1, byProduct: { light: room } }), null)
  }
})

test('variant transitions reuse the original tile but cannot borrow a previously decoded sibling room', () => {
  const lightRoom = galleryRoomView(roomlessStory, 'light', aiRooms).page
  const darkRoom = galleryRoomView(roomlessStory, 'dark', aiRooms).page
  const previous = { tile: { page: roomlessStory.page, src: roomlessStory.page.image },
    room: { page: lightRoom, src: lightRoom.detailImage } }
  const next = matchingGallerySources(previous, { tile: roomlessStory.page, room: darkRoom })
  assert.deepEqual(Object.keys(next), ['tile'])
  assert.equal(next.tile.src, roomlessStory.page.image)
  assert.equal(previous.room.src, lightRoom.detailImage)
  assert.deepEqual(matchingGallerySources(previous, { room: lightRoom }).room, previous.room)
  assert.deepEqual(matchingGallerySources(previous, { room: { ...lightRoom, detailImage: '/catalogue-rooms/light.new.detail.webp' } }), {})
})

test('a shared publisher page can supply both views while retaining the requested source geometry', () => {
  const previous = { tile: { page: roomlessStory.page, src: roomlessStory.page.image } }
  const result = matchingGallerySources(previous, { tile: roomlessStory.page, room: roomlessStory.page })
  assert.equal(result.tile.page, roomlessStory.page)
  assert.equal(result.room.page, roomlessStory.page)
  assert.deepEqual(matchingGallerySources(undefined, { tile: roomlessStory.page }), {})
})

const supplierPage = { number: 1, width: 1200, height: 800, image: '/catalogues/supplier/page-001.webp',
  detailImage: '/catalogues/supplier/page-001-detail.webp' }
const supplierBook = { id: 'supplier', pages: [supplierPage] }
const recoveredStory = { ...roomlessStory, bookId: 'supplier', book: supplierBook }
const recoveredRoom = { bookId: 'supplier', pageNumber: 1, rect: [.1, .2, .7, .6],
  label: 'Supplier room photograph', provenance: 'publisher' }
const recoveredRooms = { ...aiRooms, publisherByProduct: { light: recoveredRoom } }

test('an exact-product supplier recovery takes priority over AI and uses its original page geometry', () => {
  const result = galleryRoomView(recoveredStory, 'light', recoveredRooms)
  assert.equal(result.page, supplierPage)
  assert.equal(result.page.number, 1)
  assert.equal(result.productId, 'light')
  assert.equal(result.provenance, 'publisher')
  assert.deepEqual(result.view, { pageNumber: 1, rect: recoveredRoom.rect, label: 'Supplier room photograph' })
  assert.deepEqual(cropViewBox(result.page, result.view.rect), [120, 160, 840, 480])
  assert.equal(galleryViewPage(recoveredStory, 'tile'), roomlessStory.page)
  assert.equal(recoveredStory.pageNumber, 7)
  assert.equal(galleryRoomView(recoveredStory, 'dark', recoveredRooms).provenance, 'ai-generated')
  assert.equal(galleryRoomView(recoveredStory, 'dark', { ...recoveredRooms, byProduct: {} }), null)
  for (const id of [undefined, null, 'unknown', 'toString']) assert.equal(galleryRoomView(recoveredStory, id, recoveredRooms), null)
})

test('original story rooms stay authoritative when a per-product supplier recovery is also present', () => {
  const original = { rect: [.2, .3, .5, .5], label: 'Original room setting' }
  const story = { ...recoveredStory, views: { ...recoveredStory.views, room: original } }
  const result = galleryRoomView(story, 'light', recoveredRooms)
  assert.equal(result.page, roomlessStory.page)
  assert.equal(result.view, original)
  assert.equal(result.provenance, 'publisher')
})

test('supplier recoveries reject another catalogue, malformed crop, unknown page and unverified provenance', () => {
  assert.equal(isValidPublisherRoom(recoveredRoom, supplierBook), true)
  for (const room of [null, {}, { ...recoveredRoom, bookId: 'other' }, { ...recoveredRoom, pageNumber: 0 },
    { ...recoveredRoom, pageNumber: 2 }, { ...recoveredRoom, pageNumber: 1.1 }, { ...recoveredRoom, pageNumber: '1' },
    { ...recoveredRoom, rect: [.5, .5, 1, 1] }, { ...recoveredRoom, rect: [0, 0, NaN, 1] },
    { ...recoveredRoom, label: 'AI room preview' }, { ...recoveredRoom, provenance: 'ai-generated' }]) {
    assert.equal(isValidPublisherRoom(room, supplierBook), false, JSON.stringify(room))
    assert.equal(galleryRoomView(recoveredStory, 'light', { version: 1, publisherByProduct: { light: room } }), null)
  }
  for (const page of [{ ...supplierPage, number: 2 }, { ...supplierPage, width: 0 }, { ...supplierPage, height: Infinity },
    { ...supplierPage, image: 'https://example.test/photo.webp' },
    { ...supplierPage, image: '/catalogues/other/page-001.webp' },
    { ...supplierPage, detailImage: '/catalogues/other/page-001-detail.webp' }]) {
    assert.equal(isValidPublisherRoom(recoveredRoom, { ...supplierBook, pages: [page] }), false)
  }
  assert.equal(galleryRoomView({ ...recoveredStory, bookId: 'other' }, 'light', { version: 1, publisherByProduct: { light: recoveredRoom } }), null)
  assert.equal(galleryRoomView(recoveredStory, 'light', { ...recoveredRooms, version: 2 }), null)
})

test('all audited supplier recoveries resolve only their listed products and preserve catalogue provenance', () => {
  const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const source = json('../../scripts/catalogue-publisher-room-sources.json')
  const rooms = json('../data/catalogueRooms.generated.json')
  const realBooks = json('../data/catalogueBooks.generated.json')
  const realStories = json('../data/catalogueGallery.generated.json').stories
  assert.equal(source.version, 1)
  assert.equal(source.entries.length, 30)
  assert.deepEqual(Object.keys(rooms.publisherByProduct).sort(), source.entries.map(entry => entry.productId).sort())
  for (const entry of source.entries) {
    const story = realStories.find(story => story.productIds.includes(entry.productId))
    const book = realBooks.find(book => book.id === story.bookId)
    const resolved = { ...story, book, page: book.pages[story.pageNumber - 1] }
    const result = galleryRoomView(resolved, entry.productId, rooms)
    assert.equal(result.provenance, 'publisher', entry.productId)
    assert.equal(result.productId, entry.productId)
    assert.equal(result.page, book.pages[entry.sourcePage - 1])
    assert.deepEqual(result.view.rect, entry.sourceRect)
    assert.equal(result.view.label, entry.label)
    assert.equal(entry.bookId, story.bookId)
    assert.equal(entry.sourceHash, book.sourceHash)
    assert.equal(entry.sourcePdf, book.sourceName)
    assert.ok(entry.evidence && entry.confidence)
    assert.equal(Object.hasOwn(rooms.byProduct, entry.productId), false)
  }
})

test('the black Zeus basin room never substitutes for its neighboring toilet, nor SWIM for a different size', () => {
  const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const rooms = json('../data/catalogueRooms.generated.json')
  const supplierOnly = { ...rooms, byProduct: {} }
  const book = json('../data/catalogueBooks.generated.json').find(book => book.id === 'simpolo')
  const realStories = json('../data/catalogueGallery.generated.json').stories
  const resolve = productId => {
    const story = realStories.find(story => story.productIds.includes(productId))
    return galleryRoomView({ ...story, book, page: book.pages[story.pageNumber - 1] }, productId, supplierOnly)
  }
  assert.equal(resolve('simpolo-p17-d6').page.number, 16)
  assert.equal(resolve('simpolo-p17-d5'), null)
  assert.equal(resolve('simpolo-p23-d1').page.number, 22)
  assert.equal(resolve('simpolo-p24-d1'), null)
})

test('failed room images link to the recovered supplier page without changing product or AI PDF links', () => {
  const recovered = galleryRoomView(recoveredStory, 'light', recoveredRooms)
  assert.equal(galleryFallbackPdfPage(recoveredStory, 'room', recovered), 1)
  for (const kind of ['tile', 'pair']) assert.equal(galleryFallbackPdfPage(recoveredStory, kind, recovered), 7)
  const generated = galleryRoomView(recoveredStory, 'dark', recoveredRooms)
  assert.equal(galleryFallbackPdfPage(recoveredStory, 'room', generated), 7)
  assert.equal(galleryFallbackPdfPage(recoveredStory, 'room', null), 7)
  const original = { ...recoveredStory, views: { ...recoveredStory.views, room: { pageNumber: 1, rect: [0, 0, 1, 1] } } }
  assert.equal(galleryFallbackPdfPage(original, 'room', galleryRoomView(original, 'light', recoveredRooms)), 1)
})
