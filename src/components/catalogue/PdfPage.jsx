import { useEffect, useId, useRef, useState } from 'react'
import { getOriginalPageUrl, getPageLayout } from '../../utils/pdfViewport'

function useViewportSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

function retryUrl(url, attempt) {
  if (!url || !attempt) return url
  return `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}`
}

/**
 * An uncropped publisher page with native scrolling at larger zoom levels.
 * The supplied PDFs contain scanned pages, so source-resolution page images
 * preserve their printed details without downloading the entire PDF.
 * The parent owns navigation, zoom, fullscreen and adjacent page details.
 */
export default function PdfPage({
  book,
  pageNumber,
  zoom = 1,
  highDetail = false,
  className = 'h-full',
  onStatusChange,
}) {
  const viewportRef = useRef(null)
  const previewImageRef = useRef(null)
  const detailImageRef = useRef(null)
  const statusCallbackRef = useRef(onStatusChange)
  statusCallbackRef.current = onStatusChange
  const hintId = useId()
  const [retry, setRetry] = useState({ key: '', preview: 0, detail: 0 })
  const [imageState, setImageState] = useState({ key: '', state: 'loading' })
  const [detailState, setDetailState] = useState({ key: '', state: 'loading' })
  const page = book?.pages?.find((entry) => entry.number === pageNumber)
  const pageKey = `${book?.id}:${pageNumber}`
  const previewAttempt = retry.key === pageKey ? retry.preview : 0
  const detailAttempt = retry.key === pageKey ? retry.detail : 0
  const previewKey = `${pageKey}:${page?.image}:${previewAttempt}`
  const detailKey = `${pageKey}:${page?.detailImage}:${detailAttempt}`
  const currentAssetRef = useRef({ previewKey, detailKey })
  currentAssetRef.current = { previewKey, detailKey }
  const size = useViewportSize(viewportRef)
  const layout = getPageLayout({
    width: page?.width,
    height: page?.height,
    containerWidth: size.width,
    containerHeight: size.height,
    zoom,
  })
  const wantsDetail = highDetail && Boolean(page?.detailImage)

  useEffect(() => {
    const image = previewImageRef.current
    if (!image || currentAssetRef.current.previewKey !== previewKey) return
    // SSR and memory-cache images may finish before React attaches onLoad.
    const state = image.complete ? image.naturalWidth > 0 ? 'ready' : 'error' : 'loading'
    setImageState(previous => previous.key === previewKey && previous.state === state ? previous : { key: previewKey, state })
  }, [previewKey])

  useEffect(() => {
    const image = detailImageRef.current
    if (!wantsDetail || !image || currentAssetRef.current.detailKey !== detailKey) return
    const state = image.complete ? image.naturalWidth > 0 ? 'ready' : 'error' : 'loading'
    setDetailState(previous => previous.key === detailKey && previous.state === state ? previous : { key: detailKey, state })
  }, [detailKey, wantsDetail])

  const imageFailed = imageState.key === previewKey && imageState.state === 'error'
  const imageReady = imageState.key === previewKey && imageState.state === 'ready'
  const detailReady = wantsDetail && detailState.key === detailKey && detailState.state === 'ready'
  const detailFailed = wantsDetail && detailState.key === detailKey && detailState.state === 'error'
  const state = !page || (imageFailed && !detailReady) || detailFailed ? 'error'
    : detailReady ? 'ready' : wantsDetail || !imageReady ? 'loading' : 'preview'
  const message = !page ? 'This page is unavailable. Open the original catalogue below.'
    : detailFailed ? imageReady ? 'The enlarged image could not load. The page preview is still available.' : 'This page could not load. Try again or open the original PDF.'
      : imageFailed && !detailReady ? 'The preview could not load. Try again or open the original PDF.'
        : detailReady ? 'Full detail is ready.'
          : wantsDetail ? 'Loading full detail. You can keep viewing the page.'
            : !imageReady ? 'Loading catalogue page.' : 'Page preview ready.'

  useEffect(() => {
    statusCallbackRef.current?.({ state, message })
  }, [state, message])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  }, [pageKey])

  const originalUrl = book?.pdfUrl ? getOriginalPageUrl(book.pdfUrl, pageNumber) : null

  function retryFailedImage() {
    // Retain a working preview while retrying a failed detail image, and vice versa.
    setRetry({ key: pageKey, preview: previewAttempt + Number(imageFailed), detail: detailAttempt + Number(detailFailed) })
  }

  return (
    <div className={`relative min-h-0 min-w-0 ${className}`}>
      <div
        ref={viewportRef}
        role="region"
        aria-label={`${book?.title || 'Catalogue'}, page ${pageNumber}`}
        aria-describedby={hintId}
        tabIndex={0}
        className="h-full w-full overflow-auto bg-ink/40 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
        style={{ overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}
      >
        <div
          className="grid place-items-center p-4"
          style={{ width: Math.max(size.width, layout.width + 32), height: Math.max(size.height, layout.height + 32) }}
        >
          {page ? (
            <div
              className="relative shrink-0 overflow-hidden bg-white shadow-2xl"
              style={{ width: layout.width, height: layout.height }}
            >
              <img
                ref={previewImageRef}
                key={previewKey}
                src={retryUrl(page.image, previewAttempt)}
                width={page.width}
                height={page.height}
                alt={`${book.title}, page ${pageNumber}. Complete original catalogue page with its printed tile details.`}
                decoding="async"
                draggable="false"
                onLoad={() => {
                  if (currentAssetRef.current.previewKey === previewKey) setImageState({ key: previewKey, state: 'ready' })
                }}
                onError={() => {
                  if (currentAssetRef.current.previewKey === previewKey) setImageState({ key: previewKey, state: 'error' })
                }}
                className="block h-full w-full object-contain"
                style={{ opacity: imageFailed ? 0 : 1 }}
              />
              {wantsDetail && (
                <img
                  ref={detailImageRef}
                  key={detailKey}
                  src={retryUrl(page.detailImage, detailAttempt)}
                  width={page.width}
                  height={page.height}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  draggable="false"
                  onLoad={() => {
                    if (currentAssetRef.current.detailKey === detailKey) setDetailState({ key: detailKey, state: 'ready' })
                  }}
                  onError={() => {
                    if (currentAssetRef.current.detailKey === detailKey) setDetailState({ key: detailKey, state: 'error' })
                  }}
                  className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
                  style={{ opacity: detailReady ? 1 : 0 }}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
      <span id={hintId} className="sr-only">At larger zoom levels, scroll or use the arrow keys to read every part of this page.</span>
      <div aria-live="polite" aria-atomic="true" className={state === 'error' ? 'absolute inset-x-3 bottom-3 rounded-card border border-sand/30 bg-charcoal p-3 text-sm text-cream shadow-card' : 'sr-only'}>
        <p>{message}</p>
        {state === 'error' && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {originalUrl && <a href={originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-sand-light underline underline-offset-4 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">Open original PDF</a>}
            {page && <button type="button" onClick={retryFailedImage} className="min-h-11 cursor-pointer font-semibold text-sand-light underline underline-offset-4 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">Try again</button>}
          </div>
        )}
      </div>
    </div>
  )
}
