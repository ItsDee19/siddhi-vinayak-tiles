import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { normalizeSearch, searchCatalogue, getFilterOptions } from './catalogueSearch.js'
import { readerPath, readerSelection, pageEnquiry } from './catalogueReader.js'

const readJson = relative => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'))
const index = readJson('../data/catalogueSearch.generated.json')
const books = readJson('../data/catalogueBooks.generated.json')
const { records } = index
const find = (query, filters = {}) => searchCatalogue(records, { query, ...filters })

test('real labels open the original PDF page, independent of historical crop IDs or printed spreads', () => {
  for (const [query, bookId, pageNumber] of [
    ['Jubil Green', 'global-floor', 3], ['1671-LT', 'sky', 37],
    ['1671-HL-1', 'sky', 37], ['CV Boto Grey', 'sunflora', 3], ['STONY-11', 'global-wall', 3],
    ['Galaxy Bronze', 'rich', 6], ['ANTIQUE WOOD BROWN - R9', 'planks-8x48', 1],
    ['11022-LT', 'goldcoin', 2], ['Creative Brilliant Clay (Punch)', 'coverstone', 3],
    ['DESERT BEIGE', 'lactose', 1], ['AJIO BIANCO', 'cyan', 8],
    ['10164', 'simpolo', 38], ['2551', 'skype', 3], ['FRAME FLORAL DECOR', 'seron-iconic', 7], ['NEOMI', 'seron-glossy', 3],
  ]) {
    const result = find(query, { bookId })[0]
    assert(result, query)
    assert.equal(result.pageNumber, pageNumber, query)
    const path = readerPath(result.bookId, result.pageNumber)
    assert.deepEqual(readerSelection(new URL(path, 'https://example.test').search, books), { bookId, pageNumber })
    const enquiry = pageEnquiry(books.find(book => book.id === bookId), pageNumber, 'https://example.test')
    assert(enquiry.includes(`PDF page ${pageNumber}`))
    assert(enquiry.endsWith(`https://example.test${path}`))
  }
})

test('code punctuation, spacing, case and compact forms match the same code', () => {
  const expected = find('1671-HL-1').map(record => record.id)
  for (const query of ['1671_hl_1', '1671 hl 1', '1671hl1', '  1671—HL—1  ']) {
    assert.deepEqual(find(query).map(record => record.id), expected, query)
  }
  assert.equal(find('1671hl2').length, 0, 'unprinted family variants must not be invented')
  assert.equal(find('1671-lt').filter(record => record.name.includes('HL')).length, 0)
  assert(find('007').every(record => !record.name.includes('4007')), 'significant leading zeros are preserved')
})

test('normalization removes diacritics and keeps decimal dimensions intact', () => {
  assert.equal(normalizeSearch('Júbil, GRÉEN'), 'jubil green')
  assert.equal(normalizeSearch('5 ft × 2.5 ft'), '2.5x5')
  assert.equal(normalizeSearch('600mm x 1200mm'), '600x1200')
  assert.equal(normalizeSearch('12" × 18"'), '12x18')
  assert.deepEqual(find('Júbil gréen'), find('Jubil Green'))
})

test('all query terms are required across name, code and printed dimensions', () => {
  assert(find('Jubil green 600x1200').some(record => record.name === 'JUBIL GREEN'))
  assert.equal(find('Jubil green 800x1600').length, 0)
  assert.equal(find('Jubil definitelymissing').length, 0)
  assert(find('grey matt').length > 0)
  assert.deepEqual(find('grey matte'), find('grey matt'))
})

test('size queries understand multiplication signs, units and either orientation', () => {
  const expected = find('600x1200').map(record => record.id)
  for (const query of ['600 × 1200 mm', '1200x600', '600mm x1200mm']) {
    assert.deepEqual(find(query).map(record => record.id), expected)
  }
  assert(find('12x18', { bookId: 'sky' }).length > 100)
  assert.equal(find('12x18', { bookId: 'sunflora' }).length, 0)
  assert(find('2.5x5', { bookId: 'global-floor' }).some(record => record.pageNumber === 44))
})

test('collection, size and finish filters compose and do not manufacture unknown metadata', () => {
  const selected = find('', { bookId: 'sky', size: '450x300mm', finish: 'matt' })
  assert(selected.length > 0)
  assert(selected.every(record => record.bookId === 'sky' && [24, 59, 60].includes(record.pageNumber)))
  assert.equal(find('', { bookId: 'nonexistent' }).length, 0)
  assert.equal(find('', { size: '999x999mm' }).length, 0)
  assert.equal(find('', { bookId: 'sky', finish: 'Carving' }).length, 0)
  assert(!find('', { finish: 'Glossy' }).some(record => record.kind === 'page'))
  assert.equal(find('BRIKO-CARROT', { finish: 'Glossy' }).length, 0, 'an unprinted finish is not a default Glossy finish')
  assert(find('BRIKO-CARROT').some(record => record.finish === ''))
})

test('multiple printed finish options participate in each appropriate filter', () => {
  for (const finish of ['Glossy', 'Matt']) {
    assert(find('Trinity Brown', { bookId: 'global-floor', finish }).some(record => record.name === 'TRINITY BROWN'))
  }
  const options = getFilterOptions(records)
  assert(options.finishes.includes('Glossy'))
  assert(options.finishes.includes('Matt'))
  assert(!options.finishes.includes('Glossy & Matt'))
  assert(options.sizes.includes('600 × 1200 mm'))
  assert(!options.sizes.some(size => size.includes('/')))
  for (const size of ['600x600mm', '600x1200mm']) {
    assert(find('Smoke', { bookId: 'global-floor', size }).some(record => record.name === 'SMOKE'))
  }
})

test('filter options are unique, naturally sorted and scoped to the selected book', () => {
  const options = getFilterOptions(records, { bookId: 'sky' })
  assert.deepEqual(options.sizes, ['300 × 450 mm'])
  assert.deepEqual(options.finishes, ['Glossy', 'Matt'])
  assert.deepEqual(getFilterOptions(records, { bookId: 'missing' }), { sizes: [], finishes: [] })
})

test('every result has a valid one-based source page and its actual uncropped-page thumbnail', () => {
  assert.equal(new Set(records.map(record => record.id)).size, records.length)
  for (const record of records) {
    const book = books.find(book => book.id === record.bookId)
    assert(book, record.id)
    assert(Number.isInteger(record.pageNumber) && record.pageNumber >= 1 && record.pageNumber <= book.pageCount, record.id)
    assert.equal(record.thumbnail, book.pages.find(page => page.number === record.pageNumber).thumbnail)
    assert(!record.thumbnail.includes('swatch'))
    assert(existsSync(new URL(`../../public${record.thumbnail}`, import.meta.url)), record.thumbnail)
  }
})

test('coverage separates verified names, original-page fallbacks and non-design covers/dividers', () => {
  assert.equal(index.coverage.totalPages, books.reduce((total, book) => total + book.pageCount, 0))
  assert.equal(index.coverage.namedDesigns, records.filter(record => record.kind === 'design').length)
  assert.equal(index.coverage.fallbackPages, records.filter(record => record.kind === 'page').length)
  for (const book of index.coverage.books) {
    assert.equal(book.sourceHash, books.find(item => item.id === book.bookId).sourceHash)
    for (const page of book.excludedPages) assert(!records.some(record => record.bookId === book.bookId && record.pageNumber === page))
  }
  assert(!records.some(record => record.bookId === 'sunflora' && record.pageNumber === 28))
  for (const record of records.filter(record => record.kind === 'page')) {
    assert.equal(record.name, `Designs on page ${record.pageNumber}`)
    assert.equal(record.code, '')
    assert.equal(record.finish, '')
    assert.equal(record.size, '')
  }
})

test('visually verified corrections replace corrupt OCR labels and wrong blanket finishes', () => {
  assert.equal(find('Toners').length, 0)
  assert.equal(find('Bndndeipenas').length, 0)
  assert(find('Rapido Pearl').some(record => record.bookId === 'global-floor' && record.pageNumber === 36))
  assert(find('Sense Flora Decor').every(record => record.finish === 'POS + Punch'))
  assert(find('End Antheni Grey').every(record => record.finish === 'Carving Endless'))
})

test('every checked source label is searchable on its explicit PDF page', () => {
  for (const book of books) {
    const corrections = readJson(`../../scripts/catalogue-search-corrections-${book.id}.json`)
    assert.equal(corrections.sourceHash, book.sourceHash)
    for (const page of corrections.pages) {
      const names = page.products?.map(product => product.name) || page.codes || []
      for (const name of names) {
        assert(find(name, { bookId: book.id }).some(record => record.pageNumber === page.pdfPage && record.name === name),
          `${book.id}/${page.pdfPage}: ${name}`)
      }
    }
  }
})

test('empty queries retain publisher order, exact names rank first, and inputs are not mutated', () => {
  assert.deepEqual(find(''), records)
  assert.equal(find('Jubil Green')[0].name, 'JUBIL GREEN')
  const frozen = Object.freeze([{ id: 'b', name: 'Green Grey', code: '', bookId: 'x', size: '', finish: '' },
    { id: 'a', name: 'Green', code: '', bookId: 'x', size: '', finish: '' }].map(Object.freeze))
  assert.deepEqual(searchCatalogue(frozen, { query: 'Green' }).map(record => record.id), ['a', 'b'])
  assert.deepEqual(searchCatalogue([], { query: 'anything' }), [])
})

// Repeated publisher names can represent different finishes on different pages.
test('Cyan finish filters preserve distinct Polish and Carving versions of the same design', () => {
  const variants = find('Marbella Bianco', { bookId: 'cyan' })
  assert.deepEqual(variants.map(record => record.pageNumber), [21, 41])
  assert.deepEqual(find('Marbella Bianco', { bookId: 'cyan', finish: 'Polish' }).map(record => record.pageNumber), [21])
  assert.deepEqual(find('Marbella Bianco', { bookId: 'cyan', finish: 'Carving' }).map(record => record.pageNumber), [41])
})
