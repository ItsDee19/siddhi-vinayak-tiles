import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  clampPage, readerSelection, readerPath, thumbnailWindow, pageEnquiry, ZOOM_LEVELS,
} from '../src/utils/catalogueReader.js'

const books = JSON.parse(await readFile(new URL('../src/data/catalogueBooks.generated.json', import.meta.url), 'utf8'))
const firstBook = books[0]
let checks = 0

function check(name, run) {
  run()
  checks += 1
  console.log(`PASS ${name}`)
}

check('a direct visit starts on the first collection’s chosen showcase page', () => {
  assert.ok(books.length > 0)
  assert.deepEqual(readerSelection('', books), {
    bookId: firstBook.id, pageNumber: firstBook.featuredPage,
  })
})

check('each collection restores its own first, featured and last page from a link', () => {
  for (const book of books) {
    for (const pageNumber of [1, book.featuredPage, book.pageCount]) {
      const url = new URL(readerPath(book.id, pageNumber), 'https://example.com')
      assert.equal(url.pathname, '/')
      assert.equal(url.hash, '#visualizer', 'Existing website links must still reach the library section')
      assert.deepEqual(readerSelection(url.search, books), { bookId: book.id, pageNumber })
    }
  }
})

check('invalid or missing page values recover to the selected collection’s showcase page', () => {
  for (const book of books) {
    const selection = { bookId: book.id, pageNumber: book.featuredPage }
    assert.deepEqual(readerSelection(`?catalogue=${book.id}`, books), selection)
    for (const value of ['', '0', '-3', '1.5', 'unknown', 'NaN', 'Infinity']) {
      const params = new URLSearchParams({ catalogue: book.id, page: value })
      assert.deepEqual(readerSelection(params.toString(), books), selection, `${book.id}: ${value}`)
    }
  }
})

check('links beyond the last page clamp to that collection’s final page', () => {
  for (const book of books) {
    assert.deepEqual(readerSelection(`?catalogue=${book.id}&page=${book.pageCount + 1000}`, books), {
      bookId: book.id, pageNumber: book.pageCount,
    })
  }
})

check('unknown collection IDs safely recover to a real collection', () => {
  const result = readerSelection('?catalogue=not-a-real-collection&page=999999', books)
  assert.deepEqual(result, { bookId: firstBook.id, pageNumber: firstBook.pageCount })
  assert.deepEqual(readerSelection('?catalogue=%3Cscript%3E', books), {
    bookId: firstBook.id, pageNumber: firstBook.featuredPage,
  })
})

check('unrelated URL parameters do not change the requested catalogue page', () => {
  const book = books.at(-1)
  assert.deepEqual(readerSelection(`?utm_source=shared&catalogue=${book.id}&page=2&mode=other`, books), {
    bookId: book.id, pageNumber: 2,
  })
})

check('share links encode identifiers rather than introducing extra query parameters', () => {
  const id = 'floor & wall/#? edition'
  const url = new URL(readerPath(id, 7), 'https://example.com')
  assert.equal(url.searchParams.get('catalogue'), id)
  assert.equal(url.searchParams.get('page'), '7')
  assert.deepEqual([...url.searchParams.keys()], ['catalogue', 'page'])
  assert.equal(url.hash, '#visualizer')
})

check('page clamping keeps valid end points and contains a fallback within the book', () => {
  assert.equal(clampPage(1, 36), 1)
  assert.equal(clampPage('36', 36), 36)
  assert.equal(clampPage(100, 36), 36)
  assert.equal(clampPage('invalid', 36, 80), 36)
  assert.equal(clampPage('invalid', 36, -1), 1)
  assert.equal(clampPage(null, 36, 3), 3)
})

check('thumbnail windows include the current page and stay inside every original document', () => {
  for (const book of books) {
    for (const page of book.pages) {
      const window = thumbnailWindow(page.number, book.pageCount)
      const visible = book.pages.slice(window.start, window.end)
      assert.ok(window.start >= 0 && window.end <= book.pageCount)
      assert.ok(visible.length > 0 && visible.length <= 12)
      assert.ok(visible.some(item => item.number === page.number), `${book.id}, page ${page.number} must appear in its index`)
    }
  }
})

check('thumbnail paging handles group boundaries and incomplete final groups', () => {
  assert.deepEqual(thumbnailWindow(12, 25), { start: 0, end: 12 })
  assert.deepEqual(thumbnailWindow(13, 25), { start: 12, end: 24 })
  assert.deepEqual(thumbnailWindow(25, 25), { start: 24, end: 25 })
  assert.deepEqual(thumbnailWindow(1, 1), { start: 0, end: 1 })
  assert.deepEqual(thumbnailWindow(9, 10, 4), { start: 8, end: 10 })
})

check('an enquiry identifies the exact collection and page and asks the showroom to confirm details', () => {
  const origin = 'https://sidhhibinayaktiles.com'
  for (const book of books) {
    const pageNumber = book.pageCount
    const message = pageEnquiry(book, pageNumber, origin)
    assert.ok(message.includes(`PDF page ${pageNumber} of ${book.title}`))
    assert.ok(message.includes('confirm the design, size, finish, price and availability'))
    const link = message.split('\n').at(-1)
    assert.equal(new URL(link).origin, origin)
    assert.deepEqual(readerSelection(new URL(link).search, books), { bookId: book.id, pageNumber })
  }
})

check('zoom presets start at fit and increase to a useful detail view', () => {
  assert.equal(ZOOM_LEVELS[0], 1)
  assert.ok(ZOOM_LEVELS.at(-1) >= 2)
  for (let index = 0; index < ZOOM_LEVELS.length; index += 1) {
    assert.ok(Number.isFinite(ZOOM_LEVELS[index]))
    if (index) assert.ok(ZOOM_LEVELS[index] > ZOOM_LEVELS[index - 1])
  }
})

console.log(`Catalogue reader checks passed: ${checks} cases across ${books.length} collections and ${books.reduce((total, book) => total + book.pageCount, 0)} original pages.`)
