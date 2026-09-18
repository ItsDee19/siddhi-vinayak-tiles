import { useEffect, useRef, useState } from 'react'
import CatalogueCrop from './CatalogueCrop'
import ReaderIcon from './ReaderIcon'
import focusMap from '../../data/catalogueFocus.generated.json'
import { getSwipeNavigation, loadDecodedPageImage } from '../../utils/pdfViewport'
import { galleryViewPage as viewPage } from '../../utils/catalogueGallery'

export default function CatalogueGallery({ story, adjacent = [], direction, view, onViewChange, onNext, onPrevious, onStatusChange, onDetails, selectedProductId, onSelectProduct }) {
  const [frames, setFrames] = useState({ current: null, previous: null })
  const [loadState, setLoadState] = useState('loading')
  const [retry, setRetry] = useState(0)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const gesture = useRef(null)
  const region = useRef(null)
  const selectionRef = useRef(selectedProductId)
  selectionRef.current = selectedProductId
  const frame = frames.current
  const frameRef = useRef(frame)
  frameRef.current = frame
  const requestedView = story.views.room ? (compact && view === 'pair' ? 'tile' : view) : 'tile'
  const activeView = frame?.view || requestedView
  const focusedSamples = focusMap.byStory[frame?.story.id] || []
  const visibleProductId = frame?.story.id === story.id ? selectedProductId : frame?.productId
  const sample = focusedSamples.find(item => item.productId === visibleProductId) || focusedSamples[0]
  const shownProduct = frame?.story.products.find(product => product.id === sample?.productId)
  const title = shownProduct?.name || frame?.story.title || 'Loading design…'
  const specs = shownProduct ? [shownProduct.size, shownProduct.finish].filter(Boolean).join(' · ') : frame?.story.specs

  useEffect(() => {
    // Keep a variant with its decoded frame while a different story is loading.
    setFrames(previous => previous.current?.story.id === story.id && previous.current.productId !== selectedProductId
      ? { ...previous, current: { ...previous.current, productId: selectedProductId } } : previous)
  }, [selectedProductId, story.id])

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
    const pages = Object.fromEntries(['tile', 'room'].filter(kind => story.views[kind]).map(kind => [kind, viewPage(story, kind)]))
    const sources = frameRef.current?.story.id === story.id ? { ...frameRef.current.sources } : {}
    // A pair may be printed on one page or on two separately proportioned pages.
    for (const [kind, page] of Object.entries(pages)) {
      const decoded = Object.values(sources).find(source => source.page.image === page?.image)
      if (decoded) sources[kind] = decoded
    }
    const requiredKinds = requestedView === 'pair' ? ['tile', 'room'] : [requestedView]
    const requiredPages = [...new Set(requiredKinds.map(kind => pages[kind]))]
    const mayPrefetch = !navigator.connection?.saveData && !/(^|-)2g/.test(navigator.connection?.effectiveType || '')
    setLoadState('loading')
    onStatusChange({ state: 'loading', message: `Loading ${story.title}.` })

    function updateSource(page, src) {
      if (!active) return
      const matching = Object.keys(pages).filter(kind => pages[kind]?.image === page.image)
      matching.forEach(kind => { sources[kind] = { page, src } })
      if (published) setFrames(previous => {
        if (previous.current?.story.id !== story.id) return previous
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
      onStatusChange({ state: 'error', message: `${story.title} could not load.` })
    }

    function publish() {
      if (!active || failed || published || requiredKinds.some(kind => !sources[kind])) return
      published = true
      setFrames(previous => ({ current: { story, sources: { ...sources }, view: requestedView, productId: selectionRef.current },
        previous: previous.current && (previous.current.story.id !== story.id || previous.current.view !== requestedView) ? previous.current : null }))
      setLoadState('ready')
      onStatusChange({ state: 'ready', message: `${story.title}. ${story.specs}` })
      if (!mayPrefetch) return
      // Upgrade only the visible views; prefetch at most the other view's preview.
      for (const page of requiredPages) {
        if (page.detailImage && !Object.values(sources).some(source => source.page.image === page.image && source.src === page.detailImage)) {
          cancels.push(loadDecodedPageImage({ url: page.detailImage, onReady: () => updateSource(page, page.detailImage), onError: () => {} }))
        }
      }
      for (const page of [...new Set(Object.values(pages))]) {
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
  }, [story, requestedView, retry, onStatusChange])

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
    const samples = focusMap.byStory[item.story.id] || []
    const productId = !outgoing && item.story.id === story.id ? selectedProductId : item.productId
    const focused = samples.find(candidate => candidate.productId === productId) || samples[0]
    const tileView = focused ? { rect: focused.rect, label: focused.label } : item.story.views.tile
    return <div key={`${item.story.id}-${mode}-${focused?.productId || ''}`} className={`gallery-artwork gallery-view-${mode}${outgoing ? ' gallery-outgoing' : ' gallery-incoming'}`} aria-hidden={outgoing || undefined} style={{ '--slide-direction': direction }}>
      {['tile', 'room'].filter(kind => item.sources[kind]).map(kind => <figure className={`gallery-figure gallery-${kind}`} key={kind}>
        <CatalogueCrop page={item.sources[kind].page} view={kind === 'tile' ? tileView : item.story.views[kind]} src={item.sources[kind].src} label={outgoing ? undefined : `${kind === 'tile' && focused ? focused.label : item.story.title} — ${kind === 'tile' ? 'Complete design' : item.story.views[kind].label}`} />
      </figure>)}
    </div>
  }

  return <div className="material-gallery" role="region" aria-roledescription="carousel" aria-label="Product design gallery" aria-busy={loadState === 'loading'} tabIndex={0} ref={region}>
    <div className="gallery-topline">
      <div className="gallery-caption" aria-live="polite" aria-atomic="true">
        <div><h4>{title}</h4><p className="gallery-specs">{specs || frame?.story.book.format || 'Specifications on the original catalogue page'}</p></div>
        <button type="button" className="reader-control" aria-label="Design details" data-panel-toggle="details" disabled={!frame || frame.story.id !== story.id || loadState !== 'ready'} onClick={onDetails}><ReaderIcon name="info" /></button>
      </div>
      <div className="gallery-view-switch" role="group" aria-label="Design view" style={{ '--view-index': activeView === 'room' ? 1 : activeView === 'pair' ? 2 : 0 }}>
      <button type="button" aria-pressed={activeView === 'tile'} className="reader-control gallery-tile-switch" onClick={() => onViewChange('tile')}>Full design</button>
      <button type="button" className="reader-control" aria-pressed={activeView === 'room'} disabled={!story.views.room} onClick={() => onViewChange('room')}>In a room</button>
      <button type="button" className="reader-control gallery-pair-switch" aria-pressed={activeView === 'pair'} disabled={!story.views.room} onClick={() => onViewChange('pair')}>Side by side</button>
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
      {loadState === 'loading' && frame && <p className="gallery-load-note">{frame.story.id === story.id ? 'Loading selected view' : 'Loading next design'} · Showing {frame.story.title}</p>}
      {loadState === 'error' && <div className="gallery-error" role="alert"><p>This view could not load.{frame ? ` Still showing ${frame.story.title}.` : ''}</p><button type="button" className="reader-control" onClick={() => setRetry(value => value + 1)}>Try again</button><a className="reader-text-action" href={`${story.book.pdfUrl}#page=${viewPage(story, requestedView === 'room' ? 'room' : 'tile')?.number || story.pageNumber}`} target="_blank" rel="noreferrer">Open original PDF</a></div>}
    </div>
    <p className="sr-only" role="status">{loadState === 'loading' ? `Loading ${story.title}.` : ''}</p>
    {focusedSamples.length > 1 && <div className="gallery-samples" role="group" aria-label="Choose a product from this design">
      {focusedSamples.map(item => <button type="button" key={item.productId} className="reader-control" aria-pressed={sample?.productId === item.productId} disabled={frame?.story.id !== story.id || loadState !== 'ready'} onClick={() => { onViewChange('tile'); onSelectProduct(item.productId) }}>{frame.story.products.find(product => product.id === item.productId)?.name || item.label}</button>)}
    </div>}
  </div>
}
