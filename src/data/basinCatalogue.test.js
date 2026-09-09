import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { basinProducts, getBasinProduct } from './basinCatalogue.js'
import { products } from './catalogue.js'
import { importedProducts } from './importedCatalogue.js'
import { isPreviewableTile } from '../utils/visualizerSelection.js'

// These values were transcribed from the printed labels in the two existing
// product photographs, rather than from the incorrectly extracted tile data.
const verifiedBasins = [
  { id: 'gt2025-c398', modelName: 'LAVISH - BEIGE', colorFamily: 'Beige' },
  { id: 'gt2025-c402', modelName: 'LAVISH - GREY', colorFamily: 'Grey' },
]

test('selectable tabletop basins retain the verified identity, dimensions and source photographs', () => {
  assert.deepEqual(basinProducts.map(product => product.id), verifiedBasins.map(product => product.id))
  for (const expected of verifiedBasins) {
    const product = getBasinProduct(expected.id)
    assert.equal(product.modelName, expected.modelName)
    assert.equal(product.colorFamily, expected.colorFamily)
    assert.equal(product.size, '455 × 340 × 135 mm')
    assert.deepEqual(product.dimensionsMM, [455, 340, 135])
    assert.equal(product.finish, 'Matte')
    assert.equal(product.shape, 'rounded-rectangle')
    assert.equal(product.shapeLabel, 'Rounded rectangle')
    assert.equal(product.assetMeshName, 'basin_vanity')
    assert.equal(product.colorSource, 'catalogue-photo-estimate')
    assert.match(product.color, /^#[0-9a-f]{6}$/i)
    assert.equal(product.imageUrl, `/assets/catalogue/${product.id}.webp`)
    const photo = readFileSync(new URL(`../../public${product.imageUrl}`, import.meta.url))
    assert.equal(photo.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(photo.subarray(8, 12).toString('ascii'), 'WEBP')
    assert.equal(product.priceRange, importedProducts.find(item => item.id === product.id).priceRange)
  }
})

test('unknown, malformed and unrelated fixture IDs cannot resolve to a selectable basin', () => {
  for (const id of [undefined, null, '', 398, {}, { id: 'gt2025-c398' }, 'GT2025-C398', 'sani-001', 'sani-002', 'gt2025-c417', 'gt2025-c419', '__proto__']) {
    assert.equal(getBasinProduct(id), undefined)
  }
})

test('the main catalogue corrects each basin exactly once and excludes its photo from tile application', () => {
  assert.equal(products.length, importedProducts.length + 3)
  for (const { id } of verifiedBasins) {
    const matches = products.filter(product => product.id === id)
    assert.equal(matches.length, 1, id)
    const [product] = matches
    assert.equal(product, getBasinProduct(id))
    assert.equal(product.category, 'Sanitaryware')
    assert.equal(product.subCategory, 'Tabletop Basins')
    assert.equal(product.surface, 'Countertop')
    assert.equal(product.textureUrl, null)
    assert.equal(isPreviewableTile(product, { desktop: '/stale-tile-crop.webp' }), false)
  }
})

test('unrelated imported products stay unchanged and cannot gain basin eligibility', () => {
  const verifiedIds = new Set(verifiedBasins.map(product => product.id))
  for (const imported of importedProducts) {
    if (verifiedIds.has(imported.id)) continue
    assert.equal(getBasinProduct(imported.id), undefined, imported.id)
    assert.equal(products.find(product => product.id === imported.id), imported, imported.id)
  }
  assert.deepEqual(products.filter(product => getBasinProduct(product.id)).map(product => product.id), [...verifiedIds])
})
