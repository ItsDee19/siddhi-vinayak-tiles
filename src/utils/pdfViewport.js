const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback

/** Fit the entire printed page first. Zoom enlarges it without cropping its edges. */
export function getPageLayout({ width, height, containerWidth, containerHeight, zoom = 1, padding = 16 }) {
  const pageWidth = positive(width, 1)
  const pageHeight = positive(height, 1)
  const availableWidth = Math.max(1, positive(containerWidth, 1) - padding * 2)
  const availableHeight = Math.max(1, positive(containerHeight, 1) - padding * 2)
  const fit = Math.min(availableWidth / pageWidth, availableHeight / pageHeight)
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
