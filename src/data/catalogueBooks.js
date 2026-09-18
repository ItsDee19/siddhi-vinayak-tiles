import books from './catalogueBooks.generated.json'

// All page images preserve the full original PDF page, including every printed
// tile name and specification. `detailImage` loads only when the reader zooms.
// Many supplier PDFs have no text layer. Search uses the separately verified
// name/code index; original pages remain authoritative for specifications.
export const catalogues = books
export const catalogueBooks = catalogues
export const cataloguePageCount = catalogues.reduce((total, book) => total + book.pageCount, 0)

export function getCatalogueBook(id) {
  return catalogues.find((book) => book.id === id) || null
}

export function getCataloguePage(book, number) {
  return book?.pages.find((page) => page.number === Number(number)) || null
}
