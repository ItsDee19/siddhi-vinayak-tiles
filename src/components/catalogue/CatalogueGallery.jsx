import { useEffect, useMemo, useRef, useState } from 'react'
import CatalogueCrop from './CatalogueCrop'
import ReaderIcon from './ReaderIcon'
import focusMap from '../../data/catalogueFocus.generated.json'
import generatedRooms from '../../data/catalogueRooms.generated.json'
import { getSwipeNavigation, loadDecodedPageImage } from '../../utils/pdfViewport'
import { galleryProductId, galleryRoomView, galleryViewPage as viewPage, matchingGallerySources, galleryFallbackPdfPage } from '../../utils/catalogueGallery'

export default function CatalogueGallery({ story, adjacent = [], direction, view, onViewChange, onNext, onPrevious, onStatusChange, onDetails, selectedProductId, onSelectProduct }) {
  const [frames, setFrames] = useState({ current: null, previous: null })
  const [loadState, setLoadState] = useState('loading')
  const [retry, setRetry] = useState(0)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const gesture = useRef(null)
  const region = useRef(null)
  const frame = frames.current
  const frameRef = useRef(frame)
  frameRef.current = frame
  const productId = galleryProductId(story, selectedProductId, focusMap.byStory[story.id])
  const room = useMemo(() => galleryRoomView(story, productId, generatedRooms), [story, productId])
  const requestedView = room ? (compact && view === 'pair' ? 'tile' : view) : 'tile'
  const frameKey = JSON.stringify([story.id, productId, requestedView, room?.page.image])
  const activeView = frame?.view || requestedView
  const focusedSamples = focusMap.byStory[frame?.story.id] || []
  const shownProduct = frame?.story.products.find(product => product.id === frame?.productId)
  const title = shownProduct?.name || frame?.story.title || 'Loading design…'
  const specs = shownProduct ? [shownProduct.size, shownProduct.finish].filter(Boolean).join(' · ') : frame?.story.specs
  const frameReady = frame?.key === frameKey && loadState === 'ready'
  const variantChoices = focusedSamples.length ? focusedSamples : frame?.story.products.length > 1
    && !frame.story.views.room && frame.story.products.some(product => galleryRoomView(frame.story, product.id, generatedRooms))
      ? frame.story.products.map(product => ({ productId: product.id, label: product.name })) : []

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let active = true
    let published = false
    let failed = false
    const cancels = []
    const focused = (focusMap.byStory[story.id] || []).find(item => item.productId === productId)
    const views = { tile: focused ? { rect: focused.rect, label: focused.label } : story.views.tile,
      ...(room ? { room: room.view } : {}) }
    const pages = { tile: viewPage(story, 'tile'), ...(room ? { room: room.page } : {}) }
    const sources = matchingGallerySources(frameRef.current?.sources, pages)
    const nextTitle = story.products.find(product => product.id === productId)?.name || story.title
    const requiredKinds = requestedView === 'pair' ? ['tile', 'room'] : [requestedView]
    const requiredPages = [...new Set(requiredKinds.map(kind => pages[kind]))]
    const mayPrefetch = !navigator.connection?.saveData && !/(^|-)2g/.test(navigator.connection?.effectiveType || '')
    setLoadState('loading')
    onStatusChange({ state: 'loading', message: `Loading ${nextTitle}.` })

    function updateSource(page, src) {
      if (!active) return
      const matching = Object.keys(pages).filter(kind => pages[kind]?.image === page.image)
      matching.forEach(kind => { sources[kind] = { page, src } })
      if (published) setFrames(previous => {
        if (previous.current?.key !== frameKey) return previous
        const nextSources = { ...previous.current.sources }
        matching.forEach(kind => {
          // A late preview must never replace a decoded high-resolution image.
          if (src !== page.image || nextSources[kind]?.src !== page.detailImage) nextSources[kind] = { page, src }
        })
        return { ...previous, current: { ...previous.current, sources: nextSources } }
      })
    }

    function fail() {
      if (!active || failed || published) return
      failed = true
      setLoadState('error')
      onStatusChange({ state: 'error', message: `${nextTitle} could not load.` })
    }

    function publish() {
      if (!active || failed || published || requiredKinds.some(kind => !sources[kind])) return
      published = true
      setFrames(previous => ({ current: { key: frameKey, story, sources: { ...sources }, views, view: requestedView, productId, roomProvenance: room?.provenance },
        previous: previous.current && previous.current.key !== frameKey ? previous.current : null }))
      setLoadState('ready')
      onStatusChange({ state: 'ready', message: `${nextTitle}. ${story.specs}${requestedView !== 'tile' && room?.provenance === 'ai-generated' ? '. AI room preview; illustrative setting.' : ''}` })
      if (!mayPrefetch) return
      // Upgrade only the visible views; prefetch at most the other view's preview.
      for (const page of requiredPages) {
        if (page.detailImage && !Object.values(sources).some(source => source.page.image === page.image && source.src === page.detailImage)) {
          cancels.push(loadDecodedPageImage({ url: page.detailImage, onReady: () => updateSource(page, page.detailImage), onError: () => {} }))
        }
      }
      for (const page of [...new Set(Object.entries(pages).filter(([kind]) => kind !== 'room' || room?.provenance !== 'ai-generated').map(([, source]) => source))]) {
        if (page && !Object.values(sources).some(source => source.page.image === page.image)) {
          cancels.push(loadDecodedPageImage({ url: page.image, onReady: () => updateSource(page, page.image), onError: () => {} }))
        }
      }
    }

    if (requiredPages.some(page => !page)) fail()
    else {
      for (const page of requiredPages) {
        if (!Object.values(sources).some(source => source.page.image === page.image)) {
          cancels.push(loadDecodedPageImage({ url: page.image, onReady: () => { updateSource(page, page.image); publish() }, onError: fail }))
        }
      }
      publish()
    }
    return () => { active = false; cancels.forEach(cancel => cancel()) }
  }, [story, productId, room, requestedView, frameKey, retry, onStatusChange])

  useEffect(() => {
    if (!frames.previous) return
    const timer = setTimeout(() => setFrames(previous => ({ ...previous, previous: null })), 340)
    return () => clearTimeout(timer)
  }, [frames.previous])

  const adjacentKey = adjacent.slice(0, 2).flatMap(item => ['tile', 'room'].map(kind => viewPage(item, kind)?.image).filter(Boolean)).join('|')
  useEffect(() => {
    if (navigator.connection?.saveData || /(^|-)2g/.test(navigator.connection?.effectiveType || '')) return
    const images = [...new Set(adjacentKey.split('|').filter(Boolean))].map(url => { const image = new Image(); image.src = url; return image })
    return () => images.forEach(image => { if (!image.complete) image.removeAttribute('src') })
  }, [adjacentKey])

  function finishGesture(event) {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId) return
    const move = getSwipeNavigation({ startX: start.x, startY: start.y, endX: event.clientX, endY: event.clientY, elapsed: performance.now() - start.time, viewportWidth: region.current.clientWidth })
    if (move === 1) onNext?.()
    if (move === -1) onPrevious?.()
  }

  function artwork(item, outgoing = false) {
    const mode = item.view
    const product = item.story.products.find(candidate => candidate.id === item.productId)
    return <div key={item.key} className={`gallery-artwork gallery-view-${mode}${outgoing ? ' gallery-outgoing' : ' gallery-incoming'}`} aria-hidden={outgoing || undefined} style={{ '--slide-direction': direction }}>
      {['tile', 'room'].filter(kind => item.sources[kind] && (mode === 'pair' || mode === kind)).map(kind => <figure className={`gallery-figure gallery-${kind}${kind === 'room' && item.roomProvenance === 'ai-generated' ? ' gallery-generated-room' : ''}`} key={kind}>
        <CatalogueCrop page={item.sources[kind].page} view={item.views[kind]} src={item.sources[kind].src} label={outgoing ? undefined : `${product?.name || item.story.title} — ${kind === 'tile' ? 'Complete design' : item.views[kind].label}`} />
        {kind === 'room' && item.roomProvenance === 'ai-generated' && <figcaption>AI room preview <span>· Illustrative setting</span></figcaption>}
      </figure>)}
    </div>
  }

  return <div className="material-gallery" role="region" aria-roledescription="carousel" aria-label="Product design gallery" aria-busy={loadState === 'loading'} tabIndex={0} ref={region}>
    <div className="gallery-topline">
      <div className="gallery-caption" aria-live="polite" aria-atomic="true">
        <div><h4>{title}</h4><p className="gallery-specs">{specs || frame?.story.book.format || 'Specifications on the original catalogue page'}</p></div>
        <button type="button" className="reader-control" aria-label="Design details" data-panel-toggle="details" disabled={!frameReady} onClick={onDetails}><ReaderIcon name="info" /></button>
      </div>
      <div className="gallery-view-switch" role="group" aria-label="Design view" style={{ '--view-index': activeView === 'room' ? 1 : activeView === 'pair' ? 2 : 0 }}>
      <button type="button" aria-pressed={activeView === 'tile'} className="reader-control gallery-tile-switch" onClick={() => onViewChange('tile')}>Full design</button>
      <button type="button" className="reader-control" aria-pressed={activeView === 'room'} disabled={!room} onClick={() => onViewChange('room')}>In a room</button>
      <button type="button" className="reader-control gallery-pair-switch" aria-pressed={activeView === 'pair'} disabled={!room} onClick={() => onViewChange('pair')}>Side by side</button>
      </div>
    </div>
    <div className="gallery-art-stage" onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary || event.target.closest('button, a')) return
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerUp={finishGesture} onPointerCancel={() => { gesture.current = null }}>
      {frames.previous && artwork(frames.previous, true)}
      {frame && artwork(frame)}
      {!frame && loadState === 'loading' && <div className="gallery-first-load">Preparing your viewing room…</div>}
      {loadState === 'loading' && frame && <p className="gallery-load-note">{frame.story.id === story.id ? 'Loading selected view' : 'Loading next design'} · Showing {title}</p>}
      {loadState === 'error' && <div className="gallery-error" role="alert"><p>This view could not load.{frame ? ` Still showing ${title}.` : ''}</p><button type="button" className="reader-control" onClick={() => setRetry(value => value + 1)}>Try again</button><a className="reader-text-action" href={`${story.book.pdfUrl}#page=${galleryFallbackPdfPage(story, requestedView, room)}`} target="_blank" rel="noreferrer">Open original PDF</a></div>}
    </div>
    <p className="sr-only" role="status">{loadState === 'loading' ? `Loading ${story.title}.` : ''}</p>
    {variantChoices.length > 1 && <div className="gallery-samples" role="group" aria-label="Choose a product from this design">
      {variantChoices.map(item => <button type="button" key={item.productId} className="reader-control" aria-pressed={frame?.productId === item.productId} disabled={!frameReady} onClick={() => { onViewChange('tile'); onSelectProduct(item.productId) }}>{frame.story.products.find(product => product.id === item.productId)?.name || item.label}</button>)}
    </div>}
  </div>
}
