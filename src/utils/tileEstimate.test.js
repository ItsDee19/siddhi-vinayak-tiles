import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateTiles } from './tileEstimate.js'

const example = { lengthFt: '12', widthFt: '10', tileWidthMm: '600', tileHeightMm: '600', wastePct: '10' }

test('converts feet to millimetres and includes waste before rounding to whole tiles', () => {
  const { result, errors } = estimateTiles(example)
  assert.deepEqual(errors, {})
  assert.equal(result.areaSqFt, 120)
  assert.equal(result.tilesNeeded, 35)
})

test('exact tile coverage does not gain a tile from floating-point multiplication', () => {
  const { result } = estimateTiles({ ...example, lengthFt: '10', tileWidthMm: '304.8', tileHeightMm: '304.8' })
  assert.equal(result.tilesNeeded, 110)
})

test('zero waste is allowed and one partial tile rounds up', () => {
  const { result } = estimateTiles({ ...example, lengthFt: '1', widthFt: '1', wastePct: '0' })
  assert.equal(result.tilesNeeded, 1)
})

test('empty, negative and non-finite dimensions produce field errors rather than a result', () => {
  const { result, errors } = estimateTiles({ ...example, lengthFt: '', widthFt: '-1', tileWidthMm: 'Infinity', tileHeightMm: 'abc' })
  assert.equal(result, null)
  assert.deepEqual(Object.keys(errors), ['lengthFt', 'widthFt', 'tileWidthMm', 'tileHeightMm'])
})

test('blank or excessive allowances require a valid entered percentage', () => {
  for (const wastePct of ['', -1, 101, NaN]) {
    assert.ok(estimateTiles({ ...example, wastePct }).errors.wastePct)
  }
})

test('extreme inputs never expose Infinity or unsafe quantities', () => {
  for (const extreme of [{ lengthFt: 1e308 }, { tileWidthMm: 1e-308 }, { tileHeightMm: 1e308, tileWidthMm: 1e308 }]) {
    const { result, errors } = estimateTiles({ ...example, ...extreme })
    assert.equal(result, null)
    assert.ok(Object.keys(errors).length)
  }
})
