import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { calculateTiles, sizeCalculatorProducts as products, collections, sizeOptions } from '../data/sizeCalculatorCatalog.js'

test('compact calculator preserves all 554 product choices and 1,662 baseline calculations', () => {
  const calculations = products.flatMap(product => [5, 10, 15].map(wastePct => calculateTiles({ lengthFt: 12.5, widthFt: 8.2, sizeMm: product.sizeMm, wastePct, pcsPerBox: product.pcsPerBox, coverageSqFt: product.coverageSqFt })))
  assert.equal(products.length, 554)
  const snapshot = JSON.stringify({ products, collections, sizeOptions, calculations })
  // Captured from the original five-seed runtime before the build optimization.
  assert.equal(createHash('sha256').update(snapshot).digest('hex'), 'f0bad38ac48d462d7e106b58b14c2d1aa197666d816dbccff0be9fb1e9ef9bb9')
})
