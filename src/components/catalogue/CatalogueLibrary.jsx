import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../Icons'
import PdfPage from './PdfPage'
import ReaderDialog from './ReaderDialog'
import ReaderIcon from './ReaderIcon'
import CatalogueSearch from './CatalogueSearch'
import CatalogueGallery from './CatalogueGallery'
import { galleryStories, storiesByBook, storyById, storyByProduct } from '../../data/catalogueGallery'
import { gallerySelection, galleryPath } from '../../utils/catalogueGallery'
import { catalogues, cataloguePageCount } from '../../data/catalogueBooks'
import { business } from '../../data/siteConfig'
import { PRODUCTION_ORIGIN } from '../../data/seo'
import { ZOOM_LEVELS } from '../../utils/catalogueReader'
import collectionCovers from '../../data/catalogueCovers.generated.json'
import '../../styles/catalogue.css'
import '../../styles/catalogue-gallery.css'

const collectionName = book => book.shortTitle || book.title
const collectionImage = book => collectionCovers[book.id] || book.thumbnail || book.cover

export default function CatalogueLibrary() {
  const [selection, setSelection] = useState(() => gallerySelection(typeof window === 'undefined' ? '' : window.location.search, catalogues, galleryStories))
  const [zoomIndex, setZoomIndex] = useState(0)
  const [fitMode, setFitMode] = useState('page')
  const [galleryView, setGalleryView] = useState('tile')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({ bookId: 'all', size: 'all', finish: 'all' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [panel, setPanel] = useState(null)
  const [direction, setDirection] = useState(1)
  const [status, setStatus] = useState({ state: 'loading', message: 'Loading catalogue page.' })
  const [pageDraft, setPageDraft] = useState(String(selection.pageNumber))
  const [pageError, setPageError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [copyFallback, setCopyFallback] = useState(false)
  const [shelfPosition, setShelfPosition] = useState({ previous: false, next: false })
  const expandButtonRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchButtonRef = useRef(null)
  const readerRef = useRef(null)
  const shelfRef = useRef(null)
  const viewPositionRef = useRef(null)
  const wasExpandedRef = useRef(false)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const book = catalogues.find(item => item.id === selection.bookId) || catalogues[0]
  const pageNumber = selection.pageNumber
  const zoom = ZOOM_LEVELS[zoomIndex]
  const page = book.pages[pageNumber - 1]
  const story = storyById.get(selection.storyId)
  const sequence = storiesByBook[book.id] || []
  const storyIndex = sequence.findIndex(item => item.id === story?.id)
  const isGallery = selection.mode === 'gallery' && Boolean(story)
  const shareUrl = `${PRODUCTION_ORIGIN}${galleryPath(selection)}`
  const selectedProduct = story?.products.find(product => product.id === selection.productId)
  const enquiryUrl = `${business.whatsapp}?text=${encodeURIComponent(`Hello! I’m interested in ${selectedProduct?.name || story?.title || `a design on page ${pageNumber}`} from ${book.title}, PDF page ${pageNumber}. Please confirm its size, finish, price and availability.\n${shareUrl}`)}`

  useEffect(() => {
    const shelf = shelfRef.current
    if (!shelf) return
    const measure = () => setShelfPosition({ previous: shelf.scrollLeft > 2, next: shelf.scrollWidth - shelf.clientWidth - shelf.scrollLeft > 2 })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(shelf)
    shelf.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    measure()
    return () => { observer?.disconnect(); shelf.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    // Keep the selected cover discoverable without moving the document or focus.
    const shelf = shelfRef.current
    const card = [...(shelf?.children || [])].find(item => item.dataset.bookId === book.id)
    if (!shelf || !card) return
    const shelfBounds = shelf.getBoundingClientRect()
    const cardBounds = card.getBoundingClientRect()
    if (cardBounds.left < shelfBounds.left || cardBounds.right > shelfBounds.right) {
      shelf.scrollBy({ left: cardBounds.left - shelfBounds.left - 4, behavior: 'instant' })
    }
  }, [book.id])

  const resetView = useCallback(next => {
    setSelection(next)
    setPageDraft(String(next.pageNumber))
    setZoomIndex(0)
    setFitMode('page')
    setPageError('')
    setCopyStatus('')
    setCopyFallback(false)
  }, [])

  useEffect(() => {
    if (!expanded && wasExpandedRef.current) expandButtonRef.current?.focus({ preventScroll: true })
    wasExpandedRef.current = expanded
  }, [expanded])

  useEffect(() => {
    // Shared design links land on the stage after web fonts settle its position.
    if (!new URLSearchParams(window.location.search).has('catalogue') || window.location.hash !== '#visualizer') return
    let active = true
    const target = readerRef.current
    Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => {
      if (active && target === readerRef.current) target?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const restore = () => { resetView(gallerySelection(window.location.search, catalogues, galleryStories)); setPanel(null) }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [resetView])

  useEffect(() => {
    if (!panel) return
    const target = panel === 'pages'
      ? readerRef.current?.querySelector('[aria-current="page"]')
      : panel === 'search' ? (readerRef.current?.querySelector('.reader-filter-toggle:focus')
        ? readerRef.current?.querySelector('.reader-search-filters select') : searchInputRef.current)
      : readerRef.current?.querySelector('.reader-details .reader-panel-heading button')
    target?.focus({ preventScroll: true })
    if (panel === 'pages') target?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [panel, expanded, book.id])

  function choose(bookId, nextPage, focusPage = false, storyId = null, mode = 'gallery', productId = null) {
    const nextBook = catalogues.find(item => item.id === bookId)
    const boundedPage = Math.max(1, Math.min(nextBook.pageCount, nextPage))
    const nextSequence = storiesByBook[bookId] || []
    const nextStory = storyById.get(storyId) || nextSequence.find(item => item.pageNumber === boundedPage)
    const nextStoryIndex = nextSequence.findIndex(item => item.id === nextStory?.id)
    setDirection(bookId === book.id && (mode === 'gallery' ? nextStoryIndex < storyIndex : boundedPage < pageNumber) ? -1 : 1)
    const next = { bookId, pageNumber: boundedPage, storyId: nextStory?.id || null, mode: nextStory ? mode : 'page',
      ...(nextStory?.productIds.includes(productId) ? { productId } : {}) }
    resetView(next)
    setPanel(null)
    const url = new URL(window.location.href)
    url.searchParams.set('catalogue', bookId)
    url.searchParams.set('page', String(boundedPage))
    if (next.storyId) url.searchParams.set('design', next.storyId)
    else url.searchParams.delete('design')
    if (next.productId) url.searchParams.set('product', next.productId)
    else url.searchParams.delete('product')
    if (next.mode === 'page') url.searchParams.set('view', 'page')
    else url.searchParams.delete('view')
    url.hash = 'visualizer'
    // A collection is a navigation destination; page turns update that destination.
    if (bookId !== book.id) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    if (focusPage) requestAnimationFrame(() => {
      const viewport = readerRef.current?.querySelector('.material-gallery, .reader-stage [role="region"]')
      viewport?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      viewport?.focus({ preventScroll: true })
    })
  }

  function step(offset) {
    if (isGallery) {
      const next = sequence[storyIndex + offset]
      if (next) choose(next.bookId, next.pageNumber, false, next.id)
    } else if (pageNumber + offset >= 1 && pageNumber + offset <= book.pageCount) choose(book.id, pageNumber + offset, false, null, 'page')
  }

  function switchMode() {
    const next = story || sequence.find(item => item.pageNumber >= pageNumber) || sequence[0]
    if (isGallery) choose(book.id, pageNumber, true, story.id, 'page', selection.productId)
    else if (next) choose(book.id, next.pageNumber, true, next.id, 'gallery', selection.productId)
  }

  function closePanel() {
    const previousPanel = panel
    setPanel(null)
    requestAnimationFrame(() => {
      const target = previousPanel === 'search' ? searchButtonRef.current : readerRef.current?.querySelector(`[data-panel-toggle="${previousPanel}"]`)
      target?.focus({ preventScroll: true })
    })
  }

  function revealReader() {
    if (expanded) return
    const target = readerRef.current
    Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => {
      if (target !== readerRef.current) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'instant' : 'smooth' })
    }))
  }

  function openCollection(item) {
    choose(item.id, item.featuredPage || 1, true)
    revealReader()
  }

  function scrollCollections(offset) {
    const shelf = shelfRef.current
    if (!shelf) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    shelf.scrollBy({ left: offset * shelf.clientWidth * .85, behavior: reduceMotion ? 'instant' : 'smooth' })
  }

  function jumpToPage(event) {
    event.preventDefault()
    const next = Number(pageDraft)
    if (!Number.isInteger(next) || next < 1 || next > book.pageCount) {
      setPageError(`Choose a page from 1 to ${book.pageCount}.`)
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    choose(book.id, next, true, null, 'page')
  }

  async function copyLink() {
    const activeSelection = selectionRef.current
    try {
      await navigator.clipboard.writeText(shareUrl)
      if (selectionRef.current === activeSelection) { setCopyStatus('Design link copied'); setCopyFallback(false) }
    } catch {
      if (selectionRef.current === activeSelection) { setCopyFallback(true); setCopyStatus('Select and copy this page link.') }
    }
  }

  function handleReaderKeys(event) {
    if (event.key === 'Escape' && panel) { event.preventDefault(); event.stopPropagation(); closePanel(); return }
    if (panel) return
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || event.target.closest('input, select, textarea, button, a, [contenteditable="true"]')) return
    if (event.key === 'ArrowLeft' && (isGallery || fitMode === 'page' && zoom === 1)) {
      event.preventDefault(); step(-1)
    } else if (event.key === 'ArrowRight' && (isGallery || fitMode === 'page' && zoom === 1)) {
      event.preventDefault(); step(1)
    } else if (!isGallery && (event.key === '+' || event.key === '=')) {
      event.preventDefault(); setZoomIndex(index => Math.min(ZOOM_LEVELS.length - 1, index + 1))
    } else if (!isGallery && event.key === '-') {
      event.preventDefault(); setZoomIndex(index => Math.max(0, index - 1))
    } else if (event.key === '0') { event.preventDefault(); setZoomIndex(0) }
  }

  function renderReader(fullscreen = false) {
    const id = fullscreen ? 'reader-fullscreen' : 'reader'
    return (
      <div ref={readerRef} className={`catalogue-reader ${fullscreen ? 'catalogue-reader-expanded' : ''} ${panel === 'search' ? 'is-searching' : ''}`} onKeyDown={handleReaderKeys}>
        <header className="reader-heading">
          <div className="reader-identity">
            <span className="reader-emblem" aria-hidden="true"><ReaderIcon name="layers" /></span>
            <h3 id={`${id}-title`} className="sr-only">{collectionName(book)} — {isGallery ? 'Design gallery' : 'Original catalogue'}</h3>
            <label className="reader-collection-select"><span className="sr-only">Choose collection</span><select title={book.title} value={book.id} onChange={event => { const next = catalogues.find(item => item.id === event.target.value); choose(next.id, next.featuredPage || 1) }}>{catalogues.map(item => <option value={item.id} key={item.id}>{collectionName(item)}</option>)}</select></label>
            <span className="reader-header-note">{isGallery ? 'Design gallery' : 'Original catalogue'}</span>
          </div>
          <div className="reader-heading-actions">
            <button ref={searchButtonRef} type="button" className={`reader-control reader-find ${panel === 'search' ? 'is-active' : ''}`} aria-label="Find a product" aria-expanded={panel === 'search'} onClick={() => panel === 'search' ? closePanel() : setPanel('search')}><ReaderIcon name="search" /><span>Find a product</span></button>
            {fullscreen
              ? <button type="button" className="reader-control reader-close" data-close-reader onClick={() => setExpanded(false)} aria-label="Close full screen" title="Close full screen (Escape)"><ReaderIcon name="close" /><span>Close</span></button>
              : <button ref={expandButtonRef} type="button" className="reader-control reader-expand" aria-label="Full screen" onClick={() => { setPanel(null); setExpanded(true) }}><ReaderIcon name="expand" /><span>Full screen</span></button>}
          </div>
        </header>
        <div className="reader-search-strip" hidden={panel !== 'search'}>
          <form className="reader-search-field" role="search" onSubmit={event => { event.preventDefault(); setPanel('search') }} noValidate>
            <ReaderIcon name="search" />
            <label className="sr-only" htmlFor={`${id}-tile-search`}>Search product names or codes</label>
            <input ref={searchInputRef} id={`${id}-tile-search`} type="search" placeholder="Search product name or code…" autoComplete="off" value={searchQuery}
              onChange={event => { setSearchQuery(event.target.value); setPanel('search') }}
              onClick={() => setPanel('search')} />
            {searchQuery && <button type="button" className="reader-search-clear" aria-label="Clear product search" onClick={() => { setSearchQuery(''); setPanel('search'); searchInputRef.current?.focus() }}><ReaderIcon name="close" /></button>}
            <button type="submit" className="reader-search-submit" aria-label="Search products" title="Search products"><ReaderIcon name="arrow" /></button>
          </form>
          <button type="button" className={`reader-control reader-filter-toggle ${panel === 'search' && filtersOpen ? 'is-active' : ''}`} aria-label="Show product filters" aria-expanded={panel === 'search' && filtersOpen} onClick={() => { setFiltersOpen(current => panel === 'search' ? !current : true); setPanel('search') }}><ReaderIcon name="filter" /><span>Filters</span>{Object.values(searchFilters).some(value => value !== 'all') && <span className="reader-filter-dot" aria-label="Filters applied" />}</button>
        </div>
        <div className="reader-progress" aria-hidden="true"><span style={{ transform: `scaleX(${isGallery ? (storyIndex + 1) / sequence.length : pageNumber / book.pageCount})` }} /></div>
        <div className="reader-workspace">
          <div className="reader-canvas" hidden={panel !== null}>
            <div className="reader-stage">
              {isGallery ? <CatalogueGallery story={story} adjacent={[sequence[storyIndex - 1], sequence[storyIndex + 1]].filter(Boolean)} direction={direction} view={galleryView} onViewChange={setGalleryView} onStatusChange={setStatus} onDetails={() => setPanel('details')}
                selectedProductId={selection.productId} onSelectProduct={productId => choose(book.id, pageNumber, false, story.id, 'gallery', productId)}
                onNext={storyIndex < sequence.length - 1 ? () => step(1) : undefined} onPrevious={storyIndex > 0 ? () => step(-1) : undefined} />
                : <PdfPage book={book} pageNumber={pageNumber} zoom={zoom} fitMode={fitMode} highDetail={fitMode === 'width' || zoom > 1 || fullscreen} direction={direction} viewPositionRef={viewPositionRef}
                onStatusChange={setStatus} onNext={pageNumber < book.pageCount ? () => step(1) : undefined}
                onPrevious={pageNumber > 1 ? () => step(-1) : undefined}
                onToggleZoom={() => setZoomIndex(current => current ? 0 : 2)} />}
            </div>
          </div>
          {panel === 'search' && <CatalogueSearch query={searchQuery} filters={searchFilters} filtersOpen={filtersOpen}
            onFiltersChange={setSearchFilters} onClear={() => { setSearchQuery(''); setSearchFilters({ bookId: 'all', size: 'all', finish: 'all' }); searchInputRef.current?.focus({ preventScroll: true }) }}
            onChoose={result => { setGalleryView('tile'); choose(result.bookId, result.pageNumber, true, storyByProduct.get(result.id)?.id, 'gallery', result.id); revealReader() }} onClose={closePanel} onBrowsePages={() => setPanel('pages')} />}
          {panel === 'pages' && <section className="reader-page-browser" id={`${id}-pages`} aria-label="Browse catalogue pages">
            <div className="reader-panel-heading"><div><p className="reader-kicker">Original publisher pages</p><h4>All {book.pageCount} pages</h4></div><button type="button" className="reader-control" onClick={closePanel}><ReaderIcon name="close" /><span>Back to viewing</span></button></div>
            <div className="reader-page-grid">{book.pages.map(item => <button type="button" key={item.number} aria-label={`View page ${item.number}`} aria-current={pageNumber === item.number ? 'page' : undefined} onClick={() => choose(book.id, item.number, true, null, 'page')}>
              <span className="reader-thumbnail-image"><img src={item.thumbnail} alt="" width={item.width} height={item.height} loading="lazy" decoding="async" /></span>
              <span className="reader-thumbnail-caption">Page {String(item.number).padStart(2, '0')}{pageNumber === item.number && <ReaderIcon name="check" />}</span>
            </button>)}</div>
          </section>}
          {panel === 'details' && <section className="reader-details" id={`${id}-details`} aria-label="Page details and enquiry">
            <div className="reader-panel-heading"><div><p className="reader-kicker">Keep the details close</p><h4>Design details</h4></div><button type="button" className="reader-control" onClick={closePanel}><ReaderIcon name="close" /><span>Back to viewing</span></button></div>
            <div className="reader-detail-layout">
              <img className="reader-detail-preview" src={page.image} alt={`${book.title}, page ${pageNumber}`} width={page.width} height={page.height} />
              <div className="reader-detail-copy">
                <span className="reader-detail-label">{book.title} · Page {pageNumber}</span>
                <h4>{story?.title || 'Every detail, as printed.'}</h4>
                {story && <dl className="gallery-product-details">{story.products.map(product => <div key={product.id}><dt>{product.name}</dt><dd>{[product.code && product.code !== product.name && product.code, product.size, product.finish].filter(Boolean).join(' · ') || 'See original page for specifications'}</dd></div>)}</dl>}
                <p>View the original page for the complete printed specifications and coordinated designs.</p>
                <button type="button" className="reader-text-action" onClick={() => choose(book.id, pageNumber, true, story?.id, 'page', selection.productId)}><ReaderIcon name="layers" />View original page</button>
                <dl className="reader-detail-meta"><div><dt>Collection</dt><dd>{collectionName(book)}</dd></div><div><dt>Format</dt><dd>{book.format}</dd></div><div><dt>Original PDF</dt><dd>{book.pageCount} pages · {(book.fileSize / 1000000).toFixed(1)} MB</dd></div></dl>
                <a className="reader-primary-action" href={enquiryUrl} target="_blank" rel="noreferrer"><Icon name="whatsapp" className="h-5 w-5" />Ask about this design<ReaderIcon name="arrow" /></a>
                <p className="reader-fine-print">Our showroom can confirm the design, finish, price and availability.</p>
                <div className="reader-share-actions"><button type="button" className="reader-control" onClick={copyLink}><ReaderIcon name="link" />Copy design link</button><a className="reader-control" href={`${book.pdfUrl}#page=${pageNumber}`} target="_blank" rel="noreferrer"><ReaderIcon name="external" />Original PDF</a></div>
                <span className="reader-copy-status" role="status">{copyStatus}</span>
                {copyFallback && <label className="reader-copy-label">Page link<input className="reader-copy-input" readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
                {page.text && <p className="reader-source-text">{page.text}</p>}
              </div>
            </div>
          </section>}
        </div>
        <div className="reader-dock-area">
          {pageError && <p id={`${id}-page-error`} className="reader-page-error" role="alert">{pageError}</p>}
          <div className={`reader-dock ${isGallery ? 'gallery-dock' : 'source-dock'}`} aria-label="Catalogue controls">
            <button type="button" className={`reader-control reader-pages-toggle ${panel === 'pages' ? 'is-active' : ''}`} aria-label="Pages" data-panel-toggle="pages" aria-expanded={panel === 'pages'} aria-controls={panel === 'pages' ? `${id}-pages` : undefined} onClick={() => setPanel(current => current === 'pages' ? null : 'pages')}><ReaderIcon name="grid" /><span>Pages</span></button>
            <span className="reader-dock-divider" aria-hidden="true" />
            <div className="reader-paging">
              <button type="button" className="reader-control reader-square" aria-label={isGallery ? 'Previous design' : 'Previous catalogue page'} disabled={isGallery ? storyIndex <= 0 : pageNumber === 1} onClick={() => step(-1)}><ReaderIcon name="previous" /></button>
              {isGallery ? <div className="gallery-counter"><span>DESIGN</span><strong>{String(storyIndex + 1).padStart(2, '0')} <span>/ {sequence.length}</span></strong></div> : <form onSubmit={jumpToPage} className="reader-page-form" noValidate>
                <label className="sr-only" htmlFor={`${id}-page-number`}>Page number</label>
                <input id={`${id}-page-number`} type="text" inputMode="numeric" pattern="[0-9]*" value={pageDraft} onChange={event => { setPageDraft(event.target.value); setPageError('') }} aria-invalid={Boolean(pageError)} aria-describedby={pageError ? `${id}-page-error` : undefined} autoComplete="off" />
                <span>/ {book.pageCount}</span><button type="submit" className="reader-go" aria-label="Go to page" title="Go to page"><ReaderIcon name="arrow" /></button>
              </form>}
              <button type="button" className="reader-control reader-square" aria-label={isGallery ? 'Next design' : 'Next catalogue page'} disabled={isGallery ? storyIndex === sequence.length - 1 : pageNumber === book.pageCount} onClick={() => step(1)}><ReaderIcon name="next" /></button>
            </div>
            <span className="reader-dock-divider" aria-hidden="true" />
            {!isGallery && <div className="reader-zoom">
              <button type="button" className="reader-control reader-square" disabled={zoomIndex === 0 || panel !== null} aria-label="Zoom out" onClick={() => setZoomIndex(index => Math.max(0, index - 1))}><ReaderIcon name="minus" /></button>
              <label className="reader-fit-select"><span className="sr-only">Page sizing</span><select value={fitMode} disabled={panel !== null} onChange={event => { setFitMode(event.target.value); setZoomIndex(0) }}><option value="width">Fit width</option><option value="page">Whole page</option></select></label>
              <button type="button" className="reader-control reader-square" disabled={zoomIndex === ZOOM_LEVELS.length - 1 || panel !== null} aria-label="Zoom in" onClick={() => setZoomIndex(index => Math.min(ZOOM_LEVELS.length - 1, index + 1))}><ReaderIcon name="plus" /></button>
            </div>}
            <button type="button" className="reader-control reader-mode-toggle" disabled={!isGallery && !sequence.length} onClick={switchMode}><ReaderIcon name={isGallery ? 'layers' : 'arrow'} /><span>{isGallery ? 'Original page' : 'Design gallery'}</span></button>
          </div>
          <div className="reader-status"><span>{panel === 'search' ? 'Choose a match to see the full design' : panel === 'pages' ? 'Every original page, including printed specifications' : panel === 'details' ? 'Your next space starts here' : isGallery ? 'Swipe or use the arrows to explore' : zoom > 1 ? `${zoom * 100}% · Scroll or drag to inspect` : 'Whole original page · Use + to inspect'}</span><span className="reader-page-status">{status.state === 'loading' ? 'Loading…' : status.state === 'error' ? 'Image unavailable' : `PDF page ${pageNumber}`}</span></div>
        </div>
      </div>
    )
  }

  return (
    <section id="visualizer" className="catalogue-library" aria-labelledby="catalogue-heading">
      <div className="catalogue-container">
        <div className="catalogue-section-heading"><div><p className="eyebrow"><span className="catalogue-live-mark" aria-hidden="true" />The material library</p><h2 id="catalogue-heading">A whole new<br />way to <em>see surfaces.</em></h2></div><div className="catalogue-intro"><p>Step inside our collections.<br />Find the details that make a space yours.</p><span>{catalogues.length} collections <span aria-hidden="true">/</span> {cataloguePageCount} original pages</span></div></div>
        <div className="catalogue-shelf">
          <div className="catalogue-shelf-toolbar">
            <h3 id="catalogue-shelf-heading">Browse collections <span>{catalogues.length}</span></h3>
            <div className="catalogue-shelf-actions"><span>Swipe or use the arrows</span><button type="button" className="reader-control reader-square" aria-label="Previous collections" aria-controls="catalogue-collection-shelf" disabled={!shelfPosition.previous} onClick={() => scrollCollections(-1)}><ReaderIcon name="previous" /></button><button type="button" className="reader-control reader-square" aria-label="Next collections" aria-controls="catalogue-collection-shelf" disabled={!shelfPosition.next} onClick={() => scrollCollections(1)}><ReaderIcon name="next" /></button></div>
          </div>
          <div ref={shelfRef} id="catalogue-collection-shelf" className="catalogue-books" role="region" aria-labelledby="catalogue-shelf-heading">
            {catalogues.map(item => <button type="button" key={item.id} data-book-id={item.id} className={`catalogue-book ${book.id === item.id ? 'is-selected' : ''}`} aria-pressed={book.id === item.id} aria-label={`View ${item.title}`} onClick={() => openCollection(item)}>
              <span className={`catalogue-book-art ${!item.cardImage && !collectionCovers[item.id] ? 'is-page-cover' : ''}`}><img src={collectionImage(item)} alt="" width="440" height="220" loading="lazy" decoding="async" /><span className="catalogue-book-count">{item.pageCount} pages</span><span className="catalogue-book-selected"><ReaderIcon name={book.id === item.id ? 'check' : 'arrow'} /></span></span>
              <span className="catalogue-book-copy"><strong>{collectionName(item)}</strong><span>{item.format}</span></span>
            </button>)}
          </div>
        </div>
        {expanded ? <div className="reader-expanded-placeholder"><ReaderIcon name="expand" /><p>Your viewing room is open.</p><button type="button" className="reader-primary-action" onClick={() => setExpanded(false)}>Return to the library</button></div> : renderReader()}
        <div className="catalogue-footnote"><span><ReaderIcon name="layers" />Original artwork. Every printed detail.</span><p>Colours are shown without filters. Confirm your final shade with a physical sample.</p></div>
      </div>
      {expanded && <ReaderDialog titleId="reader-fullscreen-title" onClose={() => setExpanded(false)}>{renderReader(true)}</ReaderDialog>}
    </section>
  )
}
