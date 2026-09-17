import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../Icons'
import PdfPage from './PdfPage'
import ReaderDialog from './ReaderDialog'
import { catalogues, cataloguePageCount } from '../../data/catalogueBooks'
import { business } from '../../data/siteConfig'
import { PRODUCTION_ORIGIN } from '../../data/seo'
import { ZOOM_LEVELS, readerSelection, readerPath, thumbnailWindow, pageEnquiry } from '../../utils/catalogueReader'

function ReaderIcon({ name }) {
  const paths = {
    previous: <path d="m14 6-6 6 6 6" />,
    next: <path d="m10 6 6 6-6 6" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M5 12h14M12 5v14" />,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)" /></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function CatalogueLibrary() {
  const [selection, setSelection] = useState(() => readerSelection('', catalogues))
  const [zoomIndex, setZoomIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false)
  const [status, setStatus] = useState({ state: 'loading', message: 'Loading catalogue page.' })
  const [pageDraft, setPageDraft] = useState(String(selection.pageNumber))
  const [pageError, setPageError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [copyFallback, setCopyFallback] = useState(false)
  const expandButtonRef = useRef(null)
  const wasExpandedRef = useRef(false)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const book = catalogues.find(item => item.id === selection.bookId) || catalogues[0]
  const pageNumber = selection.pageNumber
  const zoom = ZOOM_LEVELS[zoomIndex]
  const page = book.pages.find(item => item.number === pageNumber)
  const group = thumbnailWindow(pageNumber, book.pageCount)
  const shareUrl = `${PRODUCTION_ORIGIN}${readerPath(book.id, pageNumber)}`
  const enquiryUrl = `${business.whatsapp}?text=${encodeURIComponent(pageEnquiry(book, pageNumber, PRODUCTION_ORIGIN))}`

  const resetView = useCallback(next => {
    setSelection(next)
    setPageDraft(String(next.pageNumber))
    setZoomIndex(0)
    setPageError('')
    setCopyStatus('')
    setCopyFallback(false)
  }, [])

  useEffect(() => {
    if (!expanded && wasExpandedRef.current) expandButtonRef.current?.focus({ preventScroll: true })
    wasExpandedRef.current = expanded
  }, [expanded])

  useEffect(() => {
    const restore = () => resetView(readerSelection(window.location.search, catalogues))
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [resetView])

  function choose(bookId, nextPage) {
    const next = { bookId, pageNumber: nextPage }
    resetView(next)
    const url = new URL(window.location.href)
    url.searchParams.set('catalogue', bookId)
    url.searchParams.set('page', String(nextPage))
    url.hash = 'visualizer'
    window.history.replaceState(null, '', url)
  }

  function jumpToPage(event) {
    event.preventDefault()
    const next = Number(pageDraft)
    if (!Number.isInteger(next) || next < 1 || next > book.pageCount) {
      setPageError(`Enter a whole page number from 1 to ${book.pageCount}.`)
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    choose(book.id, next)
  }

  async function copyLink() {
    const activeSelection = selectionRef.current
    try {
      await navigator.clipboard.writeText(shareUrl)
      if (selectionRef.current === activeSelection) {
        setCopyStatus('Page link copied')
        setCopyFallback(false)
      }
    } catch {
      if (selectionRef.current === activeSelection) {
        setCopyFallback(true)
        setCopyStatus('Select and copy the page link below.')
      }
    }
  }

  function handleReaderKeys(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || event.target.closest('input, select, textarea, button, a, [contenteditable="true"]')
      || zoom > 1) return
    if (event.key === 'ArrowLeft' && pageNumber > 1) {
      event.preventDefault(); choose(book.id, pageNumber - 1)
    } else if (event.key === 'ArrowRight' && pageNumber < book.pageCount) {
      event.preventDefault(); choose(book.id, pageNumber + 1)
    }
  }

  function renderReader(fullscreen = false) {
    const titleId = fullscreen ? 'reader-fullscreen-title' : 'reader-title'
    return (
      <div className={`catalogue-reader ${fullscreen ? 'catalogue-reader-expanded' : ''}`} onKeyDown={handleReaderKeys}>
        <div className="reader-heading">
          <div><p className="reader-kicker">The catalogue room</p><h3 id={titleId}>{book.title}</h3></div>
          {fullscreen
            ? <button type="button" className="reader-control" data-close-reader onClick={() => setExpanded(false)}><ReaderIcon name="close" /><span>Close</span></button>
            : <span className="reader-format">{book.format}</span>}
        </div>
        <div className="reader-toolbar" aria-label="Catalogue controls">
          <div className="reader-paging">
            <button type="button" className="reader-control reader-square" aria-label="Previous page" disabled={pageNumber === 1} onClick={() => choose(book.id, pageNumber - 1)}><ReaderIcon name="previous" /></button>
            <form onSubmit={jumpToPage} className="reader-page-form" noValidate>
              <label htmlFor={fullscreen ? 'page-number-expanded' : 'page-number'}>Page</label>
              <input id={fullscreen ? 'page-number-expanded' : 'page-number'} type="text" inputMode="numeric" pattern="[0-9]*" value={pageDraft} onChange={event => { setPageDraft(event.target.value); setPageError('') }} aria-invalid={Boolean(pageError)} aria-describedby={pageError ? `${titleId}-page-error` : undefined} autoComplete="off" />
              <span>/ {book.pageCount}</span>
              <button className="reader-control reader-go" type="submit" aria-label="Go to page">Go</button>
            </form>
            <button type="button" className="reader-control reader-square" aria-label="Next page" disabled={pageNumber === book.pageCount} onClick={() => choose(book.id, pageNumber + 1)}><ReaderIcon name="next" /></button>
          </div>
          <div className="reader-zoom">
            <button type="button" className="reader-control reader-square" disabled={zoomIndex === 0} aria-label="Zoom out" onClick={() => setZoomIndex(index => Math.max(0, index - 1))}><ReaderIcon name="minus" /></button>
            <button type="button" className="reader-control reader-fit" onClick={() => setZoomIndex(0)} aria-label={`Fit page. Current zoom ${zoom * 100}%`}>{zoom === 1 ? 'Fit page' : `${zoom * 100}%`}</button>
            <button type="button" className="reader-control reader-square" disabled={zoomIndex === ZOOM_LEVELS.length - 1} aria-label="Zoom in" onClick={() => setZoomIndex(index => Math.min(ZOOM_LEVELS.length - 1, index + 1))}><ReaderIcon name="plus" /></button>
          </div>
          {!fullscreen && <button ref={expandButtonRef} type="button" className="reader-control reader-expand" onClick={() => setExpanded(true)}><ReaderIcon name="expand" /><span>Full screen</span></button>}
        </div>
        {fullscreen && <nav aria-label="Page actions" className="flex flex-wrap items-center gap-x-2 border-b border-white/20 px-2 py-1 min-[761px]:hidden">
          <a className="reader-control" href={`${book.pdfUrl}#page=${pageNumber}`} target="_blank" rel="noreferrer">Original PDF ↗</a>
          <a className="reader-control" href={enquiryUrl} aria-label="Ask the showroom about this page" target="_blank" rel="noreferrer"><Icon name="whatsapp" className="h-4 w-4" />Ask showroom</a>
          <button type="button" className="reader-control reader-square" onClick={copyLink} aria-label="Copy this page link" title="Copy this page link"><ReaderIcon name="link" /></button>
          <span className="reader-copy-status w-full" role="status">{copyStatus}</span>
          {copyFallback && <label className="reader-small w-full">Page link<input className="reader-copy-input" readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
        </nav>}
        {pageError && <p id={`${titleId}-page-error`} className="reader-page-error" role="alert">{pageError}</p>}
        <div className="reader-content">
          <div className="reader-paper-area">
            <div className="reader-stage"><PdfPage book={book} pageNumber={pageNumber} zoom={zoom} highDetail={zoom > 1} onStatusChange={setStatus} /></div>
            <div className="reader-status"><span>{zoom > 1 ? 'Scroll to explore the enlarged page' : 'Full page · Original colours & printed details'}</span><span>{status.state === 'loading' ? status.message : `PDF page ${pageNumber} of ${book.pageCount}`}</span></div>
          </div>
          <aside className="reader-details" aria-label="Page details and enquiry">
            <p className="reader-kicker">A closer look</p>
            <h4>Every detail,<br />as printed.</h4>
            <p>Tile names, design codes, dimensions and finishes stay with their designs on the original page.</p>
            <button type="button" className="reader-detail-button" onClick={() => setZoomIndex(2)}><Icon name="search" className="h-5 w-5" />Enlarge the details</button>
            <div className="reader-detail-meta"><span>{book.format}</span><span>PDF page {pageNumber} of {book.pageCount}</span></div>
            {page?.text && <p className="reader-source-text">{page.text}</p>}
            <a className="btn-gold reader-enquiry" href={enquiryUrl} target="_blank" rel="noreferrer"><Icon name="whatsapp" className="h-4 w-4" />Ask about this page</a>
            <p className="reader-small">Share the design code with our showroom to confirm its finish, price and availability.</p>
            <a className="reader-text-link" href={`${book.pdfUrl}#page=${pageNumber}`} target="_blank" rel="noreferrer">Open original PDF <span>{(book.fileSize / 1000000).toFixed(1)} MB ↗</span></a>
            <button type="button" className="reader-text-link" onClick={copyLink}><span>Copy this page link</span><ReaderIcon name="link" /></button>
            <span className="reader-copy-status" role="status">{copyStatus}</span>
            {copyFallback && <label className="reader-small">Page link<input className="reader-copy-input" readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
          </aside>
        </div>
        <div className="reader-bottom">
          <button type="button" className="reader-control" aria-expanded={thumbnailsOpen} aria-controls={fullscreen ? 'page-index-fullscreen' : 'page-index'} onClick={() => setThumbnailsOpen(open => !open)}><Icon name="grid" className="h-4 w-4" />{thumbnailsOpen ? 'Hide page index' : 'Browse all pages'}</button>
          <span className="reader-small">{fullscreen ? 'Escape to close' : 'Zoom in to read the small print'}</span>
        </div>
        <div id={fullscreen ? 'page-index-fullscreen' : 'page-index'} className="reader-index" hidden={!thumbnailsOpen}>
          {thumbnailsOpen && <>
          <div className="reader-index-heading"><span>PDF pages {group.start + 1}–{group.end}</span><div>
            <button type="button" className="reader-control" disabled={group.start === 0} onClick={() => choose(book.id, Math.max(1, group.start - 11))}>Earlier pages</button>
            <button type="button" className="reader-control" disabled={group.end === book.pageCount} onClick={() => choose(book.id, group.end + 1)}>Later pages</button>
          </div></div>
          <div className="reader-thumbnails">{book.pages.slice(group.start, group.end).map(item => <button type="button" key={item.number} aria-label={`View PDF page ${item.number}`} aria-current={pageNumber === item.number ? 'page' : undefined} onClick={() => choose(book.id, item.number)}><img src={item.thumbnail} alt="" width={item.width} height={item.height} loading="lazy" /><span>{String(item.number).padStart(2, '0')}</span></button>)}</div>
          </>}
        </div>
      </div>
    )
  }

  return (
    <section id="visualizer" className="catalogue-library" aria-labelledby="catalogue-heading">
      <div className="catalogue-container">
        <div className="catalogue-section-heading"><div><p className="eyebrow">The tile library</p><h2 id="catalogue-heading">Room for a closer look.</h2></div><p>Four collections. {cataloguePageCount} original pages.<br />Choose a catalogue, open it wide, and find your favourite.</p></div>
        <div className="catalogue-books" aria-label="Choose a catalogue">
          {catalogues.map((item, index) => <div key={item.id} className={`catalogue-book ${book.id === item.id ? 'is-selected' : ''}`}>
            <button type="button" aria-pressed={book.id === item.id} onClick={() => choose(item.id, item.featuredPage || 1)}>
              <img src={item.thumbnail || item.cover} alt="" width="70" height="82" loading="lazy" />
              <span><span className="catalogue-book-number">0{index + 1} / {item.pageCount} pages</span><strong>{item.title}</strong><span className="catalogue-book-format">{item.format}</span></span>
            </button>
            <a
              href={readerPath(item.id, item.featuredPage || 1)}
              aria-label={`${item.title}: open the full catalogue`}
              onClick={event => { event.preventDefault(); choose(item.id, item.featuredPage || 1) }}
            >
              Collection details <span aria-hidden="true">↗</span>
            </a>
          </div>)}
        </div>
        {expanded ? <div className="reader-expanded-placeholder"><p>Your catalogue is open in full screen.</p><button type="button" className="btn-outline" onClick={() => setExpanded(false)}>Return to page</button></div> : renderReader()}
        <p className="catalogue-source-note">Complete pages from the supplied catalogues. Zoom preserves the original artwork and printed specifications; no colour filters are applied. Confirm the final shade with a physical sample.</p>
      </div>
      {expanded && <ReaderDialog titleId="reader-fullscreen-title" onClose={() => setExpanded(false)}>{renderReader(true)}</ReaderDialog>}
    </section>
  )
}
