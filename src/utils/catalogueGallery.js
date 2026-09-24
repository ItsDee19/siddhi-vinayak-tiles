import { readerSelection } from './catalogueReader.js'

export function galleryViewPage(story, kind) {
  const view = story.views[kind]
  if (!view) return null
  return view.pageNumber === undefined ? story.page : story.book.pages[view.pageNumber - 1] || null
}

/** An image failure links to its real supplier page; generated rooms keep the product listing. */
export function galleryFallbackPdfPage(story, kind, room) {
  if (kind === 'room' && room?.provenance === 'publisher'
    && Number.isInteger(room.page?.number) && room.page.number > 0) return room.page.number
  return galleryViewPage(story, kind === 'room' ? 'room' : 'tile')?.number || story.pageNumber
}

/** A board never borrows a room from a neighbouring product or collection. */
export function galleryProductId(story, selectedProductId, samples = []) {
  if (!story) return null
  if (story.productIds.includes(selectedProductId)) return selectedProductId
  const focused = samples.find(sample => story.productIds.includes(sample.productId))
  return focused?.productId || (story.productIds.length === 1 ? story.productIds[0] : null)
}

const roomAssetUrl = value => typeof value === 'string'
  && /^\/catalogue-rooms\/[a-z0-9][a-z0-9._/-]*\.(?:webp|avif|jpg|jpeg|png)$/i.test(value)
  && !value.split('/').includes('..')

export function isValidGeneratedRoom(room) {
  return Boolean(room && room.provenance === 'ai-generated' && room.label === 'AI room preview'
    && roomAssetUrl(room.image) && (!room.detailImage || roomAssetUrl(room.detailImage))
    && Number.isInteger(room.width) && room.width > 0 && room.width <= 16384
    && Number.isInteger(room.height) && room.height > 0 && room.height <= 16384)
}

/** Supplier recoveries must point to a real page in this exact catalogue. */
export function isValidPublisherRoom(room, book) {
  if (!room || room.provenance !== 'publisher' || room.label !== 'Supplier room photograph'
    || !book || room.bookId !== book.id || !Number.isInteger(room.pageNumber)
    || room.pageNumber < 1 || !isValidCrop(room.rect)) return false
  const page = book.pages?.[room.pageNumber - 1]
  const prefix = `/catalogues/${book.id}/page-${String(room.pageNumber).padStart(3, '0')}`
  return Boolean(page && page.number === room.pageNumber && page.image === `${prefix}.webp`
    && (!page.detailImage || page.detailImage === `${prefix}-detail.webp`)
    && Number.isFinite(page.width) && page.width > 0 && Number.isFinite(page.height) && page.height > 0)
}

/** Generated scenes have their own image geometry, never a fictitious PDF page. */
export function galleryRoomView(story, productId, rooms) {
  if (!story) return null
  if (story.views.room) {
    const page = galleryViewPage(story, 'room')
    return page ? { page, view: story.views.room, provenance: 'publisher' } : null
  }
  if (!story.productIds.includes(productId) || rooms?.version !== 1) return null
  const publisher = Object.hasOwn(rooms.publisherByProduct || {}, productId) ? rooms.publisherByProduct[productId] : null
  if (story.bookId === story.book?.id && isValidPublisherRoom(publisher, story.book)) {
    return { page: story.book.pages[publisher.pageNumber - 1],
      view: { pageNumber: publisher.pageNumber, rect: publisher.rect, label: publisher.label },
      provenance: 'publisher', productId }
  }
  const room = Object.hasOwn(rooms.byProduct || {}, productId) ? rooms.byProduct[productId] : null
  if (!isValidGeneratedRoom(room)) return null
  return { page: { image: room.image, ...(room.detailImage ? { detailImage: room.detailImage } : {}), width: room.width, height: room.height },
    view: { rect: [0, 0, 1, 1], label: room.label }, provenance: room.provenance, productId }
}

/** Reuse only images for the exact requested view; variants can share a PDF page. */
export function matchingGallerySources(previous = {}, pages = {}) {
  return Object.fromEntries(Object.entries(pages).flatMap(([kind, page]) => {
    const source = Object.values(previous).find(item => item.page.image === page?.image
      && [page.image, page.detailImage].includes(item.src))
    return source ? [[kind, { page, src: source.src }]] : []
  }))
}

export function gallerySelection(search, books, stories) {
  const original = readerSelection(search, books)
  const params = new URLSearchParams(search)
  const exact = stories.find(story => story.id === params.get('design') && story.bookId === original.bookId)
  const story = exact || stories.find(item => item.bookId === original.bookId && item.pageNumber === original.pageNumber)
  const productId = story?.productIds?.includes(params.get('product')) ? params.get('product') : null
  return { ...original, pageNumber: story?.pageNumber || original.pageNumber, storyId: story?.id || null,
    mode: params.get('view') === 'page' || !story ? 'page' : 'gallery', ...(productId ? { productId } : {}) }
}

export function galleryPath(selection) {
  const params = new URLSearchParams({ catalogue: selection.bookId, page: String(selection.pageNumber) })
  if (selection.storyId) params.set('design', selection.storyId)
  if (selection.productId) params.set('product', selection.productId)
  if (selection.mode === 'page') params.set('view', 'page')
  return `/?${params}#visualizer`
}

export function cropViewBox(page, rect) {
  return [rect[0] * page.width, rect[1] * page.height, rect[2] * page.width, rect[3] * page.height]
}

export function isValidCrop(rect) {
  return Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite)
    && rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0
    && rect[0] + rect[2] <= 1.000001 && rect[1] + rect[3] <= 1.000001
}
