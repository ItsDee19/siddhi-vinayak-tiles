import test from 'node:test'
import assert from 'node:assert/strict'
import { products } from '../data/catalogue.js'
import { getCataloguePage, reconcileCataloguePage, productFromCatalogueQuery } from './cataloguePagination.js'

test('six-card phone pages expose every catalogue product exactly once without growing', () => {
  const seen = []
  const first = getCataloguePage(products)
  for (let index = 0; index < first.pageCount; index += 1) {
    const page = getCataloguePage(products, index)
    assert.ok(page.items.length <= 6)
    assert.equal(page.start, index * 6 + 1)
    seen.push(...page.items)
  }
  assert.deepEqual(seen, products)
  assert.equal(getCataloguePage(products, first.pageCount - 1).end, products.length)
})

test('previous pages restore the same products and desktop pages have a fixed 24-item limit', () => {
  const first = getCataloguePage(products, 0, 24)
  const second = getCataloguePage(products, 1, 24)
  assert.equal(first.items.length, 24)
  assert.equal(second.start, 25)
  assert.equal(second.end, 48)
  assert.deepEqual(getCataloguePage(products, second.pageIndex - 1, 24).items, first.items)
  assert.equal(new Set([...first.items, ...second.items]).size, 48)
})

test('filtering and empty results cannot leave an out-of-range page or phantom products', () => {
  const reduced = products.slice(0, 7)
  assert.deepEqual(getCataloguePage(reduced, 999).items, reduced.slice(6))
  assert.equal(getCataloguePage(reduced, -4).pageIndex, 0)
  assert.deepEqual(getCataloguePage([], 9), { pageIndex: 0, pageCount: 0, items: [], start: 0, end: 0 })
})

test('filter and breakpoint resets persist through repeated viewport changes', () => {
  const desktopPage = { results: products, index: 2, size: 24 }
  assert.equal(reconcileCataloguePage(desktopPage, products, 24), desktopPage)
  const phone = reconcileCataloguePage(desktopPage, products, 6)
  assert.equal(phone.index, 0)
  assert.equal(reconcileCataloguePage(phone, products, 24).index, 0)
  const phonePage = { results: products, index: 8, size: 6 }
  const filtered = products.filter((product) => product.category === 'Sanitaryware')
  const reset = reconcileCataloguePage(phonePage, filtered, 6)
  assert.equal(reset.index, 0)
  assert.equal(reconcileCataloguePage(reset, products, 6).index, 0)
})

test('deep links resolve an exact inventory ID, including products outside the first page', () => {
  const product = products.at(-1)
  assert.equal(productFromCatalogueQuery(products, `?product=${encodeURIComponent(product.id)}`), product)
  assert.equal(productFromCatalogueQuery(products, '?product=unknown-product'), null)
  assert.equal(productFromCatalogueQuery(products, '?product=javascript%3Aalert(1)'), null)
  assert.equal(productFromCatalogueQuery(products, '?product='), null)
  assert.equal(productFromCatalogueQuery(products, ''), null)
})
