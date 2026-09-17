export const ZOOM_LEVELS = [1, 1.5, 2, 3]

export function clampPage(value, count, fallback = 1) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return Math.min(count, Math.max(1, fallback))
  return Math.min(count, number)
}

export function readerSelection(search, books) {
  const params = new URLSearchParams(search)
  const book = books.find(item => item.id === params.get('catalogue')) || books[0]
  return { bookId: book.id, pageNumber: clampPage(params.get('page'), book.pageCount, book.featuredPage || 1) }
}

export function readerPath(bookId, pageNumber) {
  const params = new URLSearchParams({ catalogue: bookId, page: String(pageNumber) })
  return `/?${params}#visualizer`
}

export function thumbnailWindow(page, count, size = 12) {
  const start = Math.floor((page - 1) / size) * size
  return { start, end: Math.min(count, start + size) }
}

export function pageEnquiry(book, pageNumber, origin) {
  return `Hello! I’m interested in a design on PDF page ${pageNumber} of ${book.title}. Please help me confirm the design, size, finish, price and availability.\n${origin}${readerPath(book.id, pageNumber)}`
}
