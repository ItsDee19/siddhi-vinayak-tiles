import { readerSelection } from './catalogueReader.js'

export function galleryViewPage(story, kind) {
  const view = story.views[kind]
  if (!view) return null
  return view.pageNumber === undefined ? story.page : story.book.pages[view.pageNumber - 1] || null
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
