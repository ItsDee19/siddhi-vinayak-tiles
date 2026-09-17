import test from 'node:test'
import assert from 'node:assert/strict'
import { getPageLayout, getOriginalPageUrl } from './pdfViewport.js'

test('fit view shows a complete landscape page on a narrow phone', () => {
  const layout = getPageLayout({ width: 1200, height: 800, containerWidth: 360, containerHeight: 560 })
  assert.equal(layout.width, 328)
  assert.ok(layout.height < 528)
  assert.equal(layout.width / layout.height, 1.5)
})

test('fit view keeps portrait page specifications visible inside a short stage', () => {
  const layout = getPageLayout({ width: 600, height: 900, containerWidth: 1000, containerHeight: 500 })
  assert.equal(layout.height, 468)
  assert.equal(layout.width, 312)
})

test('zoom preserves the full page aspect ratio and enlarges into scrollable space', () => {
  const params = { width: 1200, height: 800, containerWidth: 360, containerHeight: 560 }
  const fit = getPageLayout(params)
  const zoom = getPageLayout({ ...params, zoom: 3 })
  assert.ok(Math.abs(zoom.width - fit.width * 3) < 0.001)
  assert.ok(Math.abs(zoom.height - fit.height * 3) < 0.001)
  assert.ok(zoom.width > params.containerWidth)
})

test('invalid or unmeasured viewport values never produce zero or NaN page sizes', () => {
  const layout = getPageLayout({ width: 0, height: undefined, containerWidth: 0, containerHeight: 0, zoom: NaN })
  assert.equal(layout.width, 1)
  assert.equal(layout.height, 1)
})

test('original file fallback opens the selected printed page', () => {
  assert.equal(getOriginalPageUrl('/catalogues/sky.pdf#old', 18), '/catalogues/sky.pdf#page=18')
  assert.equal(getOriginalPageUrl('/catalogues/sky.pdf', -2), '/catalogues/sky.pdf#page=1')
})
