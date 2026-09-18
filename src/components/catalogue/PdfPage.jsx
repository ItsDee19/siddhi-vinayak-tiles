import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { capturePageViewPosition, getAdjacentPreviewUrls, getOriginalPageUrl, getPageLayout, getPageViewportScroll, getSwipeNavigation, loadDecodedPageImage, restorePageViewPosition, retainViewportSize } from '../../utils/pdfViewport'
import '../../styles/pdf-page.css'

function useViewportSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element
      setSize(previous => retainViewportSize(previous, { width, height }))
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
  return !url || !attempt ? url : `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}`
}

/** Decode before replacing visible paper; abandoned requests cannot publish a frame. */
function usePageImage(url, key, enabled = true) {
  const [resource, setResource] = useState({ key: '', state: 'loading' })
  useEffect(() => {
    if (!url || !enabled) return undefined
    return loadDecodedPageImage({ url, onReady: () => setResource({ key, state: 'ready' }), onError: () => setResource({ key, state: 'error' }) })
  }, [url, key, enabled])
  return !enabled || !url ? 'idle' : resource.key === key ? resource.state : 'loading'
}

/**
 * Faithful publisher pages. The parent owns navigation, zoom and the reader shell.
 * Optional gestures call the same parent actions as toolbar controls; native
 * scrolling and keyboard access remain available without dragging or swiping.
 */
export default function PdfPage({ book, pageNumber, zoom = 1, fitMode = 'page', highDetail = false, className = 'h-full', onStatusChange, onNext, onPrevious, onToggleZoom, direction = 1, viewPositionRef }) {
  const viewportRef = useRef(null)
  const statusCallbackRef = useRef(onStatusChange)
  statusCallbackRef.current = onStatusChange
  const gestureRef = useRef(null)
  const geometryRef = useRef(null)
  const restorationPendingRef = useRef(true)
  const clickBlockedUntilRef = useRef(0)
  const hintId = useId()
  const reducedMotion = useReducedMotion()
  const size = useViewportSize(viewportRef)
  const [dragging, setDragging] = useState(false)
  const [retry, setRetry] = useState({ key: '', preview: 0, detail: 0 })
  const [frames, setFrames] = useState({ current: null, outgoing: null })
  const page = book?.pages?.find(entry => entry.number === pageNumber)
  const pageKey = `${book?.id}:${pageNumber}`
  const previewAttempt = retry.key === pageKey ? retry.preview : 0
  const detailAttempt = retry.key === pageKey ? retry.detail : 0
  const previewUrl = retryUrl(page?.image, previewAttempt)
  const detailUrl = retryUrl(page?.detailImage, detailAttempt)
  const previewKey = `${pageKey}:${previewUrl}`
  const detailKey = `${pageKey}:${detailUrl}`
  const wantsDetail = highDetail && Boolean(page?.detailImage)
  const previewState = usePageImage(previewUrl, previewKey, Boolean(page))
  const detailState = usePageImage(detailUrl, detailKey, wantsDetail)
  const readyUrl = detailState === 'ready' ? detailUrl : previewState === 'ready' ? previewUrl : null
  const readyQuality = detailState === 'ready' ? 'detail' : 'preview'
  const currentRequestRef = useRef(pageKey)
  currentRequestRef.current = pageKey

  useEffect(() => {
    if (!page || !readyUrl || currentRequestRef.current !== pageKey) return
    setFrames(previous => {
      const samePage = previous.current?.key === pageKey
      // A decoded detail image remains useful when returning to fit view.
      if (samePage && (previous.current.src === readyUrl || previous.current.quality === 'detail' && readyQuality === 'preview')) return previous
      return {
        current: { key: pageKey, page, title: book.title, src: readyUrl, quality: readyQuality, direction: direction < 0 ? -1 : 1 },
        outgoing: samePage ? previous.outgoing : previous.current,
      }
    })
  }, [page, pageKey, readyUrl, readyQuality, book?.title, direction])

  useEffect(() => {
    if (!frames.outgoing) return undefined
    const key = frames.current?.key
    const timer = window.setTimeout(() => {
      setFrames(previous => previous.current?.key === key ? { ...previous, outgoing: null } : previous)
    }, reducedMotion ? 0 : 260)
    return () => window.clearTimeout(timer)
  }, [frames.current?.key, frames.outgoing, reducedMotion])

  const visiblePage = frames.current?.page || page
  const mode = fitMode === 'width' ? 'width' : 'page'
  const layout = getPageLayout({ width: visiblePage?.width, height: visiblePage?.height, containerWidth: size.width, containerHeight: size.height, zoom, fitMode: mode })
  const stageWidth = Math.max(size.width, layout.width + 32)
  const stageHeight = Math.max(size.height, layout.height + 32)
  const displayedCurrent = frames.current?.key === pageKey
  const canPan = displayedCurrent && size.width > 0 && (stageWidth > size.width + 1 || stageHeight > size.height + 1)
  const imageFailed = previewState === 'error'
  const detailFailed = wantsDetail && detailState === 'error'
  const detailVisible = displayedCurrent && frames.current?.quality === 'detail'
  const state = !page || (imageFailed && !detailVisible) || detailFailed ? 'error'
    : !displayedCurrent || wantsDetail && !detailVisible ? 'loading'
      : detailVisible ? 'ready' : 'preview'
  const retainedNote = frames.current && !displayedCurrent ? ` Showing page ${frames.current.page.number} until this page is available.` : ''
  const message = !page ? 'This page is unavailable. Open the original catalogue below.'
    : detailFailed ? displayedCurrent ? 'Full detail could not load. The page preview is still available.' : `This page could not load.${retainedNote}`
      : imageFailed && !detailVisible ? `Page ${pageNumber} could not load. Try again or open the original PDF.${retainedNote}`
        : !displayedCurrent ? `Loading page ${pageNumber}.${retainedNote}`
          : wantsDetail && !detailVisible ? 'Loading full detail. You can keep viewing the page.'
            : detailVisible ? 'Full detail is ready.' : 'Page preview ready.'

  useEffect(() => { statusCallbackRef.current?.({ state, message }) }, [state, message])

  useEffect(() => {
    const viewport = viewportRef.current
    // Do not recalculate scroll geometry while a parent panel hides this reader.
    if (!viewport || viewport.clientWidth <= 0 || viewport.clientHeight <= 0 || size.width <= 0 || size.height <= 0) return
    const nextGeometry = { pageKey, frameKey: frames.current?.key, fitMode: mode, zoom, width: stageWidth, height: stageHeight }
    const restored = restorationPendingRef.current ? restorePageViewPosition(viewPositionRef?.current, { ...nextGeometry, containerWidth: size.width, containerHeight: size.height }) : null
    const nextScroll = restored || getPageViewportScroll({ previous: geometryRef.current, next: nextGeometry, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop, containerWidth: size.width, containerHeight: size.height })
    viewport.scrollLeft = nextScroll.left
    viewport.scrollTop = nextScroll.top
    geometryRef.current = nextGeometry
    // Loading/hidden mounts cannot erase the bookmark before a full-size page exists.
    if (displayedCurrent) restorationPendingRef.current = false
    saveViewPosition()
    gestureRef.current = null
    setDragging(false)
  }, [pageKey, frames.current?.key, mode, zoom, stageWidth, stageHeight, size.width, size.height, viewPositionRef])

  useEffect(() => {
    if (!displayedCurrent || previewState !== 'ready') return undefined
    const connection = navigator.connection
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return undefined
    const images = getAdjacentPreviewUrls(book?.pages, pageNumber).map(url => {
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      image.src = url
      return image
    })
    return () => { images.forEach(image => { if (!image.complete) image.removeAttribute('src') }) }
  }, [book?.pages, pageNumber, previewState, displayedCurrent])

  function saveViewPosition() {
    const viewport = viewportRef.current
    const geometry = geometryRef.current
    if (!viewPositionRef || restorationPendingRef.current || !displayedCurrent || !viewport
      || geometry?.pageKey !== pageKey || geometry.fitMode !== mode || geometry.zoom !== zoom) return
    const saved = capturePageViewPosition({ ...geometry, containerWidth: viewport.clientWidth, containerHeight: viewport.clientHeight, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop })
    if (saved) viewPositionRef.current = saved
  }

  function handlePointerDown(event) {
    if (!event.isPrimary) { gestureRef.current = null; return }
    if (!displayedCurrent || event.button !== 0) return
    const viewport = viewportRef.current
    const bounds = viewport.getBoundingClientRect()
    // Native scrollbar thumbs remain draggable instead of becoming paper pans.
    if (event.clientX - bounds.left >= viewport.clientWidth || event.clientY - bounds.top >= viewport.clientHeight) return
    if (canPan && event.pointerType !== 'touch') {
      event.preventDefault()
      viewport.focus({ preventScroll: true })
      viewport.setPointerCapture?.(event.pointerId)
      gestureRef.current = { mode: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false }
      setDragging(true)
    } else if (zoom === 1 && event.pointerType === 'touch' && (onNext || onPrevious)) {
      gestureRef.current = { mode: 'swipe', pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, key: pageKey }
    }
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.mode !== 'pan') return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    gesture.moved ||= Math.abs(dx) + Math.abs(dy) > 5
    viewportRef.current.scrollLeft = gesture.left - dx
    viewportRef.current.scrollTop = gesture.top - dy
  }

  function handlePointerEnd(event) {
    const gesture = gestureRef.current
    gestureRef.current = null
    setDragging(false)
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (gesture.mode === 'pan' && gesture.moved) clickBlockedUntilRef.current = event.timeStamp + 300
    if (event.type !== 'pointerup' || gesture.mode !== 'swipe' || zoom !== 1 || gesture.key !== pageKey) return
    const turn = getSwipeNavigation({ startX: gesture.x, startY: gesture.y, endX: event.clientX, endY: event.clientY, elapsed: event.timeStamp - gesture.time, viewportWidth: size.width })
    if (turn === 1 && pageNumber < book.pageCount) onNext?.()
    else if (turn === -1 && pageNumber > 1) onPrevious?.()
  }

  function renderFrame(frame, outgoing = false) {
    if (!frame) return null
    const paper = getPageLayout({ width: frame.page.width, height: frame.page.height, containerWidth: size.width, containerHeight: size.height, zoom, fitMode: mode })
    return (
      <div key={frame.key} className={`pdf-layer ${mode === 'width' ? 'pdf-layer--top' : ''} ${outgoing ? 'pdf-layer--outgoing' : 'pdf-layer--current'}`} style={{ width: paper.width, height: paper.height }} aria-hidden={outgoing || !displayedCurrent ? true : undefined}>
        <div className={`pdf-sheet ${frames.outgoing ? outgoing ? 'pdf-sheet--departing' : 'pdf-sheet--arriving' : ''}`} style={{ '--pdf-travel': `${(frames.current?.direction || 1) * 14}px` }}>
          <img src={frame.src} width={frame.page.width} height={frame.page.height} alt={outgoing ? '' : `${frame.title}, page ${frame.page.number}. Complete original catalogue page with its printed tile details.`} draggable="false" className="pdf-page-image" />
        </div>
      </div>
    )
  }

  const originalUrl = book?.pdfUrl ? getOriginalPageUrl(book.pdfUrl, pageNumber) : null
  const canSwipe = zoom === 1 && Boolean(onNext || onPrevious)
  return (
    <div className={`pdf-page ${className}`}>
      <div ref={viewportRef} role="region" aria-label={`${book?.title || 'Catalogue'}, page ${pageNumber}`} aria-describedby={hintId} aria-busy={state === 'loading'} tabIndex={0}
        className={`pdf-viewport ${zoom > 1 ? 'pdf-viewport--zoomed' : 'pdf-viewport--fit'} ${canPan ? 'pdf-viewport--pannable' : ''} ${dragging ? 'pdf-viewport--dragging' : ''}`}
        style={{ touchAction: canSwipe ? 'pan-y pinch-zoom' : 'auto' }}
        onScroll={saveViewPosition}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd}
        onDoubleClick={event => {
          if (!displayedCurrent || !onToggleZoom || event.timeStamp < clickBlockedUntilRef.current) return
          event.preventDefault()
          onToggleZoom()
        }}>
        <div className="pdf-stage" style={{ width: stageWidth, height: stageHeight }}>
          {renderFrame(frames.outgoing, true)}
          {renderFrame(frames.current)}
        </div>
      </div>
      <span id={hintId} className="sr-only">Use the page and zoom controls to explore. {mode === 'width' ? 'Scroll vertically to read this full-width page. You can also drag with a mouse or use the arrow keys.' : 'At larger zoom levels, scroll, drag with a mouse, or use the arrow keys to read the entire page.'}{canSwipe ? ' Swipe horizontally to change pages.' : ''}</span>
      <div role="status" aria-live="polite" aria-atomic="true" className={state === 'error' ? 'pdf-feedback pdf-feedback--error' : state === 'loading' ? 'pdf-feedback pdf-feedback--loading' : 'sr-only'}>
        {state === 'loading' && <span className="pdf-progress-mark" aria-hidden="true" />}
        <p>{message}</p>
        {state === 'error' && <div className="pdf-feedback-actions">
          {originalUrl && <a href={originalUrl} target="_blank" rel="noreferrer">Open original PDF</a>}
          {page && <button type="button" onClick={() => setRetry({ key: pageKey, preview: previewAttempt + Number(imageFailed), detail: detailAttempt + Number(detailFailed) })}>Try again</button>}
        </div>}
      </div>
    </div>
  )
}
