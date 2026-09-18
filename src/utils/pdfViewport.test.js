import test from 'node:test'
import assert from 'node:assert/strict'
import { capturePageViewPosition, getAdjacentPreviewUrls, getOriginalPageUrl, getPageLayout, getPageViewportScroll, getSwipeNavigation, getZoomScroll, loadDecodedPageImage, restorePageViewPosition, retainViewportSize } from './pdfViewport.js'

test('opening a hidden details panel retains visible page geometry without triggering a recenter', () => {
  const visible = { width: 1100, height: 720 }
  const hidden = retainViewportSize(visible, { width: 0, height: 0 })
  assert.equal(hidden, visible)
  assert.equal(retainViewportSize(hidden, { width: 1100, height: 720 }), visible)
  assert.equal(retainViewportSize(visible, { width: 0, height: 720 }), visible)
  assert.deepEqual(retainViewportSize(visible, { width: 390, height: 560 }), { width: 390, height: 560 })
})

test('an image failure remains terminal even when an earlier decode finishes later', async () => {
  let decoded
  const calls = []
  const image = { complete: false, decode: () => new Promise(resolve => { decoded = resolve }) }
  loadDecodedPageImage({ url: '/page.webp', createImage: () => image, onReady: () => calls.push('ready'), onError: () => calls.push('error') })
  const pending = image.onload()
  image.onerror()
  decoded()
  await pending
  assert.deepEqual(calls, ['error'])
})

test('page replacement waits for decode, and cancelled stale decodes cannot replace current paper', async () => {
  let decoded
  const calls = []
  const image = { complete: false, decode: () => new Promise(resolve => { decoded = resolve }), removeAttribute: name => calls.push(`remove:${name}`) }
  const cancel = loadDecodedPageImage({ url: '/page.webp', createImage: () => image, onReady: () => calls.push('ready'), onError: () => calls.push('error') })
  const pending = image.onload()
  assert.deepEqual(calls, [])
  cancel()
  decoded()
  await pending
  assert.deepEqual(calls, ['remove:src'])
  assert.equal(image.onload, null)
  assert.equal(image.onerror, null)
})

test('cached pages publish once after decode; corrupt images report failure instead of replacing the page', async () => {
  const calls = []
  const image = { complete: true, naturalWidth: 1800, decode: () => Promise.resolve() }
  loadDecodedPageImage({ url: '/cached.webp', createImage: () => image, onReady: () => calls.push('ready'), onError: () => calls.push('error') })
  await Promise.resolve()
  await image.onload()
  assert.deepEqual(calls, ['ready'])
  const broken = { complete: false, decode: () => Promise.reject(new Error('Corrupt bitmap')) }
  loadDecodedPageImage({ url: '/broken.webp', createImage: () => broken, onReady: () => calls.push('wrong'), onError: () => calls.push('error') })
  await broken.onload()
  assert.deepEqual(calls, ['ready', 'error'])
})

test('portrait and landscape pages fit completely, preserving the publisher aspect ratio', () => {
  for (const [width, height] of [[1600, 3500], [3305, 2337]]) {
    const fit = getPageLayout({ width, height, containerWidth: 390, containerHeight: 560 })
    assert.ok(fit.width <= 358 && fit.height <= 528)
    assert.ok(Math.abs(fit.width / fit.height - width / height) < 1e-9)
    const zoom = getPageLayout({ width, height, containerWidth: 390, containerHeight: 560, zoom: 2 })
    assert.equal(zoom.width, fit.width * 2)
    assert.equal(zoom.height, fit.height * 2)
  }
})

test('full-width portrait pages use the screen width and remain vertically scrollable without cropping', () => {
  const width = getPageLayout({ width: 1600, height: 3500, containerWidth: 390, containerHeight: 560, fitMode: 'width' })
  assert.equal(width.width, 358)
  assert.ok(width.height > 560)
  assert.ok(Math.abs(width.width / width.height - 1600 / 3500) < 1e-9)
  const wholePage = getPageLayout({ width: 1600, height: 3500, containerWidth: 390, containerHeight: 560 })
  assert.ok(width.width > wholePage.width)
  const zoom = getPageLayout({ width: 1600, height: 3500, containerWidth: 390, containerHeight: 560, fitMode: 'width', zoom: 1.5 })
  assert.equal(zoom.width, width.width * 1.5)
  assert.equal(zoom.height, width.height * 1.5)
})

test('full-width landscape spreads fill wide screens rather than shrinking to a short viewport', () => {
  const page = getPageLayout({ width: 3305, height: 2337, containerWidth: 1440, containerHeight: 600, fitMode: 'width' })
  assert.equal(page.width, 1408)
  assert.ok(page.height > 600)
  assert.ok(Math.abs(page.width / page.height - 3305 / 2337) < 1e-9)
})

test('fit changes and delayed new pages reset to the top; quality upgrades preserve the reading position', () => {
  const geometry = { pageKey: 'sky:3', frameKey: 'sky:3', fitMode: 'width', width: 400, height: 900 }
  const base = { previous: geometry, next: geometry, scrollLeft: 0, scrollTop: 250, containerWidth: 400, containerHeight: 600 }
  assert.deepEqual(getPageViewportScroll(base), { left: 0, top: 250 })
  assert.deepEqual(getPageViewportScroll({ ...base, next: { ...geometry, fitMode: 'page' } }), { left: 0, top: 0 })
  assert.deepEqual(getPageViewportScroll({ ...base, previous: { ...geometry, fitMode: 'page' } }), { left: 0, top: 0 })
  const loadingNext = { ...geometry, pageKey: 'sky:4' }
  assert.deepEqual(getPageViewportScroll({ ...base, next: loadingNext }), { left: 0, top: 0 })
  assert.deepEqual(getPageViewportScroll({ ...base, previous: loadingNext, next: { ...loadingNext, frameKey: 'sky:4', height: 1400 } }), { left: 0, top: 0 })
})

test('a reading location survives full-screen viewport resizing on the same page', () => {
  const inline = { pageKey: 'sky:37', frameKey: 'sky:37', fitMode: 'width', zoom: 1.5, width: 900, height: 1800, containerWidth: 600, containerHeight: 500 }
  const saved = capturePageViewPosition({ ...inline, scrollLeft: 180, scrollTop: 600 })
  assert.deepEqual(saved, { pageKey: 'sky:37', fitMode: 'width', zoom: 1.5, x: 0.2, y: 1 / 3 })
  const fullscreen = { ...inline, width: 1200, height: 2400, containerWidth: 800, containerHeight: 750 }
  const restored = restorePageViewPosition(saved, fullscreen)
  assert.deepEqual(restored, { left: 240, top: 800 })
  const back = capturePageViewPosition({ ...fullscreen, scrollLeft: restored.left, scrollTop: restored.top })
  assert.deepEqual(restorePageViewPosition(back, inline), { left: 180, top: 600 })
})

test('hidden or not-yet-decoded geometry cannot capture or restore a reading location', () => {
  const geometry = { pageKey: 'sky:37', frameKey: 'sky:37', fitMode: 'width', zoom: 1, width: 600, height: 1400, containerWidth: 600, containerHeight: 500 }
  const saved = capturePageViewPosition({ ...geometry, scrollLeft: 0, scrollTop: 700 })
  for (const invalid of [{ containerWidth: 0 }, { containerHeight: 0 }, { width: NaN }, { frameKey: undefined }, { frameKey: 'sky:36' }]) {
    assert.equal(capturePageViewPosition({ ...geometry, ...invalid, scrollLeft: 0, scrollTop: 0 }), null)
    assert.equal(restorePageViewPosition(saved, { ...geometry, ...invalid }), null)
  }
})

test('saved positions respect navigation, sizing changes, explicit top resets and scroll bounds', () => {
  const geometry = { pageKey: 'sky:37', frameKey: 'sky:37', fitMode: 'width', zoom: 1, width: 600, height: 1400, containerWidth: 600, containerHeight: 500 }
  const saved = capturePageViewPosition({ ...geometry, scrollLeft: 0, scrollTop: 700 })
  for (const changed of [{ pageKey: 'sky:38', frameKey: 'sky:38' }, { fitMode: 'page' }, { zoom: 2 }]) {
    assert.equal(restorePageViewPosition(saved, { ...geometry, ...changed }), null)
  }
  const reset = capturePageViewPosition({ ...geometry, scrollLeft: 0, scrollTop: 0 })
  assert.deepEqual(restorePageViewPosition(reset, geometry), { left: 0, top: 0 })
  assert.deepEqual(restorePageViewPosition(saved, { ...geometry, containerHeight: 1200 }), { left: 0, top: 200 })
  assert.deepEqual(restorePageViewPosition(saved, { ...geometry, containerHeight: 1600 }), { left: 0, top: 0 })
})

test('adjacent prefetch stays bounded to previews and respects book boundaries', () => {
  const pages = [1, 2, 3].map(number => ({ number, image: `/p${number}.webp`, detailImage: `/p${number}-detail.webp` }))
  assert.deepEqual(getAdjacentPreviewUrls(pages, 1), ['/p2.webp'])
  assert.deepEqual(getAdjacentPreviewUrls(pages, 2), ['/p1.webp', '/p3.webp'])
  assert.deepEqual(getAdjacentPreviewUrls(pages, 3), ['/p2.webp'])
  assert.deepEqual(getAdjacentPreviewUrls(pages, 99), [])
  assert.deepEqual(getAdjacentPreviewUrls([], 1), [])
})

test('intentional horizontal swipes navigate, while taps, vertical scrolling and long presses do not', () => {
  const swipe = { startX: 240, startY: 200, endX: 150, endY: 215, elapsed: 250, viewportWidth: 390 }
  assert.equal(getSwipeNavigation(swipe), 1)
  assert.equal(getSwipeNavigation({ ...swipe, endX: 330 }), -1)
  assert.equal(getSwipeNavigation({ ...swipe, endX: 225 }), 0)
  assert.equal(getSwipeNavigation({ ...swipe, endY: 350 }), 0)
  assert.equal(getSwipeNavigation({ ...swipe, endY: 270 }), 0)
  assert.equal(getSwipeNavigation({ ...swipe, elapsed: 1500 }), 0)
  assert.equal(getSwipeNavigation({ ...swipe, endX: NaN }), 0)
})

test('zoom keeps the current reading point centred and clamps when returning to fit', () => {
  assert.deepEqual(getZoomScroll({ scrollLeft: 0, scrollTop: 0, previousWidth: 400, previousHeight: 600, nextWidth: 800, nextHeight: 1200, containerWidth: 400, containerHeight: 600 }), { left: 200, top: 300 })
  assert.deepEqual(getZoomScroll({ scrollLeft: 400, scrollTop: 500, previousWidth: 800, previousHeight: 1200, nextWidth: 400, nextHeight: 600, containerWidth: 400, containerHeight: 600 }), { left: 0, top: 0 })
  assert.deepEqual(getZoomScroll({ scrollLeft: 200, scrollTop: 300, previousWidth: 800, previousHeight: 1200, nextWidth: 1200, nextHeight: 1800, containerWidth: 400, containerHeight: 600 }), { left: 400, top: 600 })
})

test('original PDF fallback targets the requested page without stacking fragments', () => {
  assert.equal(getOriginalPageUrl('/catalogue.pdf#page=2', 17), '/catalogue.pdf#page=17')
  assert.equal(getOriginalPageUrl('/catalogue.pdf', -1), '/catalogue.pdf#page=1')
})
