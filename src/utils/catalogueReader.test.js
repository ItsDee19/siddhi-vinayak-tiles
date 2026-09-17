import test from 'node:test'
import assert from 'node:assert/strict'
import { clampPage, readerSelection, readerPath, thumbnailWindow, pageEnquiry } from './catalogueReader.js'
const books = [{ id: 'global-floor', title: 'Global floor', pageCount: 72, featuredPage: 3 }, { id: 'sky', title: 'Sky', pageCount: 73, featuredPage: 3 }]
test('deep links select a valid collection and bound page numbers', () => {
  assert.deepEqual(readerSelection('?catalogue=sky&page=73', books), { bookId: 'sky', pageNumber: 73 })
  assert.deepEqual(readerSelection('?catalogue=unknown&page=999', books), { bookId: 'global-floor', pageNumber: 72 })
  for (const value of ['', '0', '-1', 'NaN', '3.5', 'Infinity']) assert.equal(clampPage(value, 73, 3), 3)
})
test('every page is accessible from bounded thumbnail groups', () => {
  for (let page = 1; page <= 73; page++) {
    const { start, end } = thumbnailWindow(page, 73)
    assert.ok(start < page && end >= page && end <= 73 && end - start <= 12)
  }
})
test('shared pages and enquiries preserve the actual book and source page', () => {
  const path = readerPath('sky', 70)
  assert.deepEqual(readerSelection(new URL(path, 'https://example.com').search, books), { bookId: 'sky', pageNumber: 70 })
  const enquiry = pageEnquiry(books[1], 70, 'https://example.com')
  assert.match(enquiry, /PDF page 70 of Sky/)
  assert.ok(enquiry.endsWith('https://example.com' + path))
})
