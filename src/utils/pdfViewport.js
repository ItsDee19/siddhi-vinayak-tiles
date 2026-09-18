const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback

/** Hidden reader panels report 0×0; keep the last visible layout and scroll canvas. */
export function retainViewportSize(previous, { width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return previous
  return previous.width === width && previous.height === height ? previous : { width, height }
}

/** Fit the whole page or its width. Taller paper stays intact in the native scroller. */
export function getPageLayout({ width, height, containerWidth, containerHeight, zoom = 1, padding = 16, fitMode = 'page' }) {
  const pageWidth = positive(width, 1)
  const pageHeight = positive(height, 1)
  const availableWidth = Math.max(1, positive(containerWidth, 1) - padding * 2)
  const availableHeight = Math.max(1, positive(containerHeight, 1) - padding * 2)
  const fit = fitMode === 'width' ? availableWidth / pageWidth : Math.min(availableWidth / pageWidth, availableHeight / pageHeight)
  const scale = fit * Math.min(4, Math.max(1, positive(zoom, 1)))

  return {
    width: pageWidth * scale,
    height: pageHeight * scale,
    scale,
    fit,
  }
}

export function getOriginalPageUrl(pdfUrl, pageNumber) {
  return `${pdfUrl.split('#')[0]}#page=${Math.max(1, Math.floor(positive(pageNumber, 1)))}`
}

/** Publish only decoded images; cancellation also covers a decode already in flight. */
export function loadDecodedPageImage({ url, onReady, onError, createImage = () => new Image() }) {
  let active = true
  let decoding = false
  let settled = false
  const image = createImage()
  image.decoding = 'async'
  const fail = () => {
    if (active && !settled) { settled = true; onError() }
  }
  const loaded = async () => {
    if (decoding || !active) return
    decoding = true
    try {
      if (image.decode) await image.decode()
      if (active && !settled) { settled = true; onReady() }
    } catch { fail() }
  }
  image.onload = loaded
  image.onerror = fail
  image.src = url
  if (image.complete) {
    if (image.naturalWidth > 0) loaded()
    else fail()
  }
  return () => {
    active = false
    image.onload = null
    image.onerror = null
    if (!image.complete) image.removeAttribute('src')
  }
}

/** A clear horizontal swipe turns one page; vertical/diagonal reading gestures do not. */
export function getSwipeNavigation({ startX, startY, endX, endY, elapsed, viewportWidth }) {
  if (![startX, startY, endX, endY, elapsed].every(Number.isFinite) || elapsed < 0 || elapsed > 900) return 0
  const horizontal = endX - startX
  const vertical = endY - startY
  const threshold = Math.max(40, Math.min(72, positive(viewportWidth, 400) * 0.12))
  if (Math.abs(horizontal) < threshold || Math.abs(horizontal) < Math.abs(vertical) * 1.6) return 0
  return horizontal < 0 ? 1 : -1
}

/** Only adjacent page previews may be speculatively downloaded, never zoom assets/PDFs. */
export function getAdjacentPreviewUrls(pages = [], pageNumber) {
  const index = pages.findIndex(page => page.number === pageNumber)
  if (index < 0) return []
  return [...new Set([pages[index - 1]?.image, pages[index + 1]?.image].filter(Boolean))]
}

/** Keep the same reading position centred when the paper or viewport changes size. */
export function getZoomScroll({ scrollLeft, scrollTop, previousWidth, previousHeight, nextWidth, nextHeight, containerWidth, containerHeight }) {
  const axis = (offset, previous, next, viewport) => {
    const extent = positive(next, 1)
    const visible = positive(viewport, 1)
    const centre = (Math.max(0, Number.isFinite(offset) ? offset : 0) + visible / 2) / positive(previous, visible)
    return Math.max(0, Math.min(extent - visible, centre * extent - visible / 2))
  }
  return {
    left: axis(scrollLeft, previousWidth, nextWidth, containerWidth),
    top: axis(scrollTop, previousHeight, nextHeight, containerHeight),
  }
}

/** Navigation and fit changes start at the page top, including a delayed new frame. */
export function getPageViewportScroll({ previous, next, scrollLeft, scrollTop, containerWidth, containerHeight }) {
  if (!previous || previous.pageKey !== next.pageKey || previous.frameKey !== next.frameKey || previous.fitMode !== next.fitMode) {
    return { left: 0, top: 0 }
  }
  return getZoomScroll({ scrollLeft, scrollTop, previousWidth: previous.width, previousHeight: previous.height, nextWidth: next.width, nextHeight: next.height, containerWidth, containerHeight })
}

function hasVisibleCurrentGeometry({ pageKey, frameKey, width, height, containerWidth, containerHeight }) {
  return Boolean(pageKey) && pageKey === frameKey && [width, height, containerWidth, containerHeight].every(value => Number.isFinite(value) && value > 0)
}

/** Keep a page-relative reading position when its reader moves into/out of a dialog. */
export function capturePageViewPosition({ scrollLeft, scrollTop, ...geometry }) {
  if (!hasVisibleCurrentGeometry(geometry) || ![scrollLeft, scrollTop].every(Number.isFinite)) return null
  const { pageKey, fitMode, zoom, width, height, containerWidth, containerHeight } = geometry
  return {
    pageKey, fitMode, zoom,
    x: Math.max(0, Math.min(scrollLeft, Math.max(0, width - containerWidth))) / width,
    y: Math.max(0, Math.min(scrollTop, Math.max(0, height - containerHeight))) / height,
  }
}

/** A saved location applies only to the same decoded page and sizing choice. */
export function restorePageViewPosition(saved, geometry) {
  if (!saved || !hasVisibleCurrentGeometry(geometry) || saved.pageKey !== geometry.pageKey
    || saved.fitMode !== geometry.fitMode || saved.zoom !== geometry.zoom
    || ![saved.x, saved.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return null
  return {
    left: Math.max(0, Math.min(saved.x * geometry.width, geometry.width - geometry.containerWidth)),
    top: Math.max(0, Math.min(saved.y * geometry.height, geometry.height - geometry.containerHeight)),
  }
}
