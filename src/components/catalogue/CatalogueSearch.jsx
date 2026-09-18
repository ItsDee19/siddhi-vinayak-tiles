import { useEffect, useMemo, useRef, useState } from 'react'
import ReaderIcon from './ReaderIcon'
import CatalogueCrop from './CatalogueCrop'
import { storyByProduct } from '../../data/catalogueGallery'
import focusMap from '../../data/catalogueFocus.generated.json'
import { galleryViewPage } from '../../utils/catalogueGallery'
import { catalogues } from '../../data/catalogueBooks'
import catalogueIndex from '../../data/catalogueSearch.generated.json'
import { getFilterOptions, searchCatalogue } from '../../utils/catalogueSearch'

const PAGE_SIZE = 24
const bookTitles = Object.fromEntries(catalogues.map(book => [book.id, book.title]))

export default function CatalogueSearch({ query, filters, filtersOpen, onFiltersChange, onClear, onChoose, onClose, onBrowsePages }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const scrollRef = useRef(null)
  const results = useMemo(() => searchCatalogue(catalogueIndex.records, { query, ...filters }), [query, filters])
  const options = useMemo(() => getFilterOptions(catalogueIndex.records, { bookId: filters.bookId }), [filters.bookId])
  const hasFilters = Boolean(query.trim()) || Object.values(filters).some(value => value !== 'all')
  const filterSummary = [filters.bookId !== 'all' && bookTitles[filters.bookId], filters.size !== 'all' && filters.size, filters.finish !== 'all' && filters.finish].filter(Boolean).join(' · ')

  useEffect(() => {
    setLimit(PAGE_SIZE)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [query, filters])

  useEffect(() => {
    if (filtersOpen && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [filtersOpen])

  function showMore() {
    const firstNewIndex = limit
    setLimit(value => value + PAGE_SIZE)
    requestAnimationFrame(() => scrollRef.current?.querySelectorAll('.reader-search-result')[firstNewIndex]?.focus())
  }

  return (
    <section ref={scrollRef} className="reader-search-panel" aria-label="Product search results">
      <div className="reader-panel-heading">
        <div><p className="reader-kicker">Find your design</p><h4>Search the collections</h4></div>
        <button type="button" className="reader-control" onClick={onClose}><ReaderIcon name="close" /><span>Back to viewing</span></button>
      </div>
      <div className="reader-search-filters" hidden={!filtersOpen}>
        <label>Collection<select value={filters.bookId} onChange={event => onFiltersChange({ bookId: event.target.value, size: 'all', finish: 'all' })}><option value="all">All collections</option>{catalogues.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
        <label>Size<select value={filters.size} onChange={event => onFiltersChange({ ...filters, size: event.target.value })}><option value="all">All sizes</option>{options.sizes.map(size => <option value={size} key={size}>{size}</option>)}</select></label>
        <label>Finish<select value={filters.finish} onChange={event => onFiltersChange({ ...filters, finish: event.target.value })}><option value="all">All finishes</option>{options.finishes.map(finish => <option value={finish} key={finish}>{finish}</option>)}</select></label>
        <button type="button" className="reader-control reader-search-reset" disabled={!hasFilters} onClick={onClear}>Reset filters</button>
      </div>
      <div className="reader-search-summary"><p role="status" aria-live="polite">{results.length} {results.length === 1 ? 'match' : 'matches'}{query.trim() ? ` for “${query.trim()}”` : ' across the catalogues'}</p><span>{filterSummary || 'Select a design to enter the gallery.'}</span></div>
      {results.length ? <>
        <div className="reader-search-results">
          {results.slice(0, limit).map(result => {
            const story = storyByProduct.get(result.id)
            const sourcePage = story && galleryViewPage(story, 'tile')
            const sample = focusMap.byStory[story?.id]?.find(item => item.productId === result.id)
            return <button type="button" className="reader-search-result" key={result.id} onClick={() => onChoose(result)} aria-label={`View ${result.name}, ${bookTitles[result.bookId]}, page ${result.pageNumber}`}>
              <span className="reader-result-art">{story ? <CatalogueCrop page={sourcePage} view={sample || story.views.tile} src={sourcePage.thumbnail} /> : <img src={result.thumbnail} alt="" loading="lazy" decoding="async" />}</span>
              <span className="reader-result-copy"><span className="reader-result-book">{bookTitles[result.bookId]}</span><strong>{result.name}</strong><span className="reader-result-specs">{[result.size, result.finish].filter(Boolean).join(' · ') || 'See the printed details on this page'}</span><span className="reader-result-action">View design<ReaderIcon name="arrow" /></span></span>
            </button>
          })}
        </div>
        <div className="reader-results-bottom"><span>Showing {Math.min(limit, results.length)} of {results.length}</span>{limit < results.length && <button type="button" className="reader-control" onClick={showMore}>Show more matches<ReaderIcon name="plus" /></button>}</div>
      </> : <div className="reader-search-empty"><ReaderIcon name="search" /><h4>No matching products</h4><p>Try a shorter name or design code, or reset your filters.</p><button type="button" className="reader-primary-action" onClick={onClear}>Clear search and filters</button></div>}
      <div className="reader-search-note"><p>Search uses indexed names and codes. All original pages are available in the page browser.</p><button type="button" className="reader-text-action" onClick={onBrowsePages}>Browse all pages<ReaderIcon name="arrow" /></button></div>
    </section>
  )
}
