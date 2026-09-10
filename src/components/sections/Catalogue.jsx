import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import SectionHeading from '../ui/SectionHeading'
import CategoryTabs from '../catalogue/CategoryTabs'
import FilterGroup from '../catalogue/FilterGroup'
import ProductCard from '../catalogue/ProductCard'
import ProductLightbox from '../catalogue/ProductLightbox'
import EmptyState from '../catalogue/EmptyState'
import Icon from '../Icons'
import { products } from '../../data/catalogue'
import {
  matchesQuery,
  normalizeSize,
  sizeLabel,
  sizeTrade,
  surfacesOfProduct,
  colorOf,
  collectionOf,
  collectionLabel,
} from '../../utils/productSearch'
import { COLOR_SWATCHES } from '../../data/colorFamilies'
import { publishVisualizerSelection } from '../../utils/visualizerPreview'
import { subscribeCatalogueCategory } from '../../utils/catalogueSelection'
import { scrollToSection } from '../../utils/sectionNavigation'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'
import { getCataloguePage, reconcileCataloguePage, productFromCatalogueQuery } from '../../utils/cataloguePagination'

const COMPACT_QUERY = '(max-width: 639px)'
const getCompactSnapshot = () => window.matchMedia(COMPACT_QUERY).matches
// The build and first hydration pass agree on six real, crawlable products.
const getServerCompactSnapshot = () => true

// ---------------------------------------------------------------------------
// The filter set is derived from what the catalogue data can actually support.
// Measured over the real 557 products:
//
//   * Colour was the single most broken filter. `product.color` is a
//     placeholder — 554 products carry the identical hex — so the old filter
//     put 556 of 557 products in "Beige" and six of its nine pills matched
//     nothing. Colour is now measured from the tile imagery at build time
//     (scripts/build_product_facets.mjs) and spreads across nine real families.
//   * Size was split by an encoding inconsistency: "600×1200mm" (Unicode ×, 140
//     products) and "600x1200mm" (ASCII x, 50) rendered as two pills, each
//     hiding the other's products. Normalised, it is one option of 190.
//   * Sub-category had the same word-order split ("Wall & Floor Tiles" 292 vs
//     "Floor & Wall Tiles" 50) and its Exterior/Décor options matched nothing.
//     Replaced by Surface, which answers the question people actually ask —
//     where does this tile go — across 483 floor and 414 wall products.
//   * Category tabs offered Marble, Granite and Quartz; the shop has no
//     products in any of them. Only stocked categories are shown now.
//
// Counts on each pill are contextual: they are computed against every OTHER
// active filter, so a pill's number is what you would actually get by clicking
// it. Stocked options retain a stable order as counts change; unavailable
// combinations are disabled, while active filters can always be removed.
// ---------------------------------------------------------------------------

const SURFACE_OPTIONS = ['Floor', 'Wall', 'Countertop']

// Build the displayed inventory once so filtering never moves a customer's
// next target out from under their pointer or keyboard focus.
const stockCounts = { color: {}, size: {}, finish: {}, collection: {} }
for (const product of products) {
  const values = {
    color: colorOf(product),
    size: normalizeSize(product.size),
    finish: product.finish,
    collection: collectionOf(product)?.id,
  }
  for (const [facet, value] of Object.entries(values)) {
    if (value) stockCounts[facet][value] = (stockCounts[facet][value] || 0) + 1
  }
}
const stockedValues = Object.fromEntries(Object.entries(stockCounts).map(([facet, counts]) => [
  facet,
  Object.keys(counts).sort((a, b) => counts[b] - counts[a]),
]))

export default function Catalogue() {
  const reduceMotion = useReducedMotion()
  const searchRef = useRef(null)
  const resultsRef = useRef(null)
  const filterPanelRef = useRef(null)
  const filterToggleRef = useRef(null)
  const cardsRef = useRef(null)
  const paginationRef = useRef(null)
  const breakpointFocus = useRef(null)
  const subscribeCompact = useCallback((notify) => {
    const media = window.matchMedia(COMPACT_QUERY)
    const onChange = () => {
      const element = document.activeElement
      const region = filterPanelRef.current?.contains(element) ? 'filters'
        : filterToggleRef.current === element ? 'toggle'
          : cardsRef.current?.contains(element) || paginationRef.current?.contains(element) ? 'results' : null
      breakpointFocus.current = region ? { element, region } : null
      notify()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  const compact = useSyncExternalStore(subscribeCompact, getCompactSnapshot, getServerCompactSnapshot)
  const pageSize = compact ? 6 : 24
  const focusResultsPending = useRef(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedSurfaces, setSelectedSurfaces] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])
  const [selectedFinishes, setSelectedFinishes] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])

  const [open, setOpen] = useState(null)
  const [page, setPage] = useState({ results: null, index: 0, size: pageSize })

  const clearAllFilters = (focusSearch = true, resetCategory = true) => {
    if (resetCategory) setCat('all')
    setQuery('')
    setSelectedColors([])
    setSelectedSurfaces([])
    setSelectedSizes([])
    setSelectedFinishes([])
    setSelectedCollections([])
    if (focusSearch) searchRef.current?.focus({ preventScroll: true })
  }

  // The bridge retains a category chosen before this lazy section mounts.
  useEffect(() => subscribeCatalogueCategory((category) => {
    setCat(category)
    clearAllFilters(false, false)
  }), [])

  useEffect(() => {
    const product = productFromCatalogueQuery(products, window.location.search)
    if (product) setOpen(product)
  }, [])

  useEffect(() => {
    if (!focusResultsPending.current) return
    focusResultsPending.current = false
    resultsRef.current?.focus({ preventScroll: true })
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' })
  }, [page, filtersOpen, reduceMotion])

  useEffect(() => {
    const pending = breakpointFocus.current
    breakpointFocus.current = null
    if (!pending) return
    const { element, region } = pending
    if (element.isConnected && !element.disabled && element.getClientRects().length) return
    // A new user action or an open modal owns focus; resizing must not steal it.
    if (document.activeElement !== element && document.activeElement !== document.body) return
    const target = region === 'filters' && compact ? filterToggleRef
      : region === 'filters' || region === 'toggle' ? searchRef : resultsRef
    target.current?.focus({ preventScroll: true })
  }, [compact])

  // One predicate per facet, so counts can be computed with a single facet
  // deliberately left out (see facetCounts below).
  const predicates = useMemo(() => ({
    cat: (p) => cat === 'all' || p.category.toLowerCase() === cat,
    query: (p) => matchesQuery(p, query),
    color: (p) => selectedColors.length === 0 || selectedColors.includes(colorOf(p)),
    surface: (p) =>
      selectedSurfaces.length === 0 ||
      surfacesOfProduct(p).some((s) => selectedSurfaces.includes(s)),
    size: (p) => selectedSizes.length === 0 || selectedSizes.includes(normalizeSize(p.size)),
    finish: (p) => selectedFinishes.length === 0 || selectedFinishes.includes(p.finish),
    collection: (p) =>
      selectedCollections.length === 0 ||
      selectedCollections.includes(collectionOf(p)?.id),
  }), [cat, query, selectedColors, selectedSurfaces, selectedSizes, selectedFinishes, selectedCollections])

  const matchAllExcept = useMemo(() => (exclude) => {
    const keys = Object.keys(predicates).filter((k) => k !== exclude)
    return products.filter((p) => keys.every((k) => predicates[k](p)))
  }, [predicates])

  const filtered = useMemo(
    () => products.filter((p) => Object.values(predicates).every((fn) => fn(p))),
    [predicates],
  )

  useEffect(() => {
    // Persist resets after hydration. A render-phase update makes React 18
    // reread the client media snapshot before the server's six cards hydrate.
    setPage((state) => reconcileCataloguePage(state, filtered, pageSize))
  }, [filtered, pageSize])

  // Build option lists with contextual counts. Each facet counts over the set
  // matching every other facet, which is what makes a pill's number equal the
  // result you get by clicking it.
  const colorOptions = useMemo(() => {
    const pool = matchAllExcept('color')
    const counts = {}
    for (const p of pool) { const c = colorOf(p); if (c) counts[c] = (counts[c] || 0) + 1 }
    return stockedValues.color
      .map((c) => ({ value: c, label: c, count: counts[c] || 0, dot: COLOR_SWATCHES[c] }))
  }, [matchAllExcept])

  const surfaceOptions = useMemo(() => {
    const pool = matchAllExcept('surface')
    const counts = {}
    for (const p of pool) for (const s of surfacesOfProduct(p)) counts[s] = (counts[s] || 0) + 1
    return SURFACE_OPTIONS.filter((s) => products.some((p) => surfacesOfProduct(p).includes(s)))
      .map((s) => ({ value: s, label: s, count: counts[s] || 0 }))
  }, [matchAllExcept])

  const sizeOptions = useMemo(() => {
    const pool = matchAllExcept('size')
    const counts = {}
    for (const p of pool) { const s = normalizeSize(p.size); if (s) counts[s] = (counts[s] || 0) + 1 }
    return stockedValues.size
      .map((value) => {
        const sample = products.find((p) => normalizeSize(p.size) === value)
        const trade = sizeTrade(sample?.size)
        return {
          value,
          label: trade ? `${sizeLabel(sample?.size)} · ${trade}` : sizeLabel(sample?.size),
          count: counts[value] || 0,
        }
      })
  }, [matchAllExcept])

  const finishOptions = useMemo(() => {
    const pool = matchAllExcept('finish')
    const counts = {}
    for (const p of pool) if (p.finish) counts[p.finish] = (counts[p.finish] || 0) + 1
    return stockedValues.finish
      .map((value) => ({ value, label: value, count: counts[value] || 0 }))
  }, [matchAllExcept])

  const collectionOptions = useMemo(() => {
    const pool = matchAllExcept('collection')
    const counts = {}
    for (const p of pool) { const c = collectionOf(p); if (c) counts[c.id] = (counts[c.id] || 0) + 1 }
    return stockedValues.collection
      .map((value) => ({ value, label: collectionLabel(value), count: counts[value] || 0 }))
  }, [matchAllExcept])

  // Only offer category tabs the shop actually stocks.
  const categoryCounts = useMemo(() => {
    const counts = {}
    for (const p of products) {
      const k = p.category.toLowerCase()
      counts[k] = (counts[k] || 0) + 1
    }
    return counts
  }, [])

  // Reset synchronously after a filter or breakpoint change. Mount a fixed
  // number of cards: browsing must not keep pushing the next section away.
  const reconciledPage = reconcileCataloguePage(page, filtered, pageSize)
  const currentPage = getCataloguePage(filtered, reconciledPage.index, pageSize)
  const changePage = (index) => {
    focusResultsPending.current = true
    setPage({ results: filtered, index, size: pageSize })
  }

  const onViewIn3D = (p) => {
    if (!publishVisualizerSelection(p)) return
    scrollToSection('visualizer', { focus: true })
  }

  const toggle = (setter) => (value) =>
    setter((list) => (list.includes(value) ? list.filter((i) => i !== value) : [...list, value]))

  const activeFilterCount =
    selectedColors.length + selectedSurfaces.length + selectedSizes.length +
    selectedFinishes.length + selectedCollections.length + (query.trim() ? 1 : 0) + (cat !== 'all' ? 1 : 0)

  return (
    <section id="catalogue" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Our Collection"
          title="Browse the Catalogue"
          subtitle="Find your tile by name, size or finish. Tap a design for full details, a 3D preview and availability."
        />
        <div className="mt-7 sm:mt-12">
          <CategoryTabs active={cat} onChange={setCat} counts={categoryCounts} />

          <div
            className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/5 bg-charcoal-800/50 p-3 backdrop-blur-sm sm:mt-6 sm:gap-4 sm:p-5"
          >
            {/* Search first: it is the fastest path for anyone who already
                knows the tile name or code, and it narrows every facet below. */}
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand/40"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code or size"
                aria-label="Search the catalogue"
                className="min-h-11 w-full rounded-btn border border-white/10 bg-charcoal-900/60 py-2.5 pl-10 pr-12 text-base text-cream placeholder:text-sand focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40 sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); searchRef.current?.focus({ preventScroll: true }) }}
                  aria-label="Clear search"
                  className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-btn text-sand hover:bg-white/10 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex min-h-11 items-center justify-between gap-3">
              <h3 className="hidden text-sm font-semibold text-cream sm:block">Filters</h3>
              <button
                ref={filterToggleRef}
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="catalogue-advanced-filters"
                onClick={() => setFiltersOpen((value) => !value)}
                className="inline-flex min-h-11 items-center gap-2 rounded-btn text-sm font-semibold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:hidden"
              >
                {filtersOpen ? 'Hide filters' : 'Filters'}
                {activeFilterCount > 0 && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">{activeFilterCount}<span className="sr-only"> active</span></span>}
                <Icon name="arrowDown" className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => clearAllFilters()}
                  type="button"
                  className="min-h-11 text-xs text-gold transition-colors hover:text-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Clear all ({activeFilterCount})
                </button>
              )}
            </div>

            <div ref={filterPanelRef} id="catalogue-advanced-filters" className={`${filtersOpen ? 'flex' : 'hidden'} flex-col gap-4 pb-2 sm:flex sm:pb-0`}>
              <FilterGroup label="Colour" options={colorOptions} selected={selectedColors} onToggle={toggle(setSelectedColors)} />
              <FilterGroup label="Surface" options={surfaceOptions} selected={selectedSurfaces} onToggle={toggle(setSelectedSurfaces)} />
              <FilterGroup label="Size" options={sizeOptions} selected={selectedSizes} onToggle={toggle(setSelectedSizes)} />
              <FilterGroup label="Finish" options={finishOptions} selected={selectedFinishes} onToggle={toggle(setSelectedFinishes)} />
              <FilterGroup label="Range" options={collectionOptions} selected={selectedCollections} onToggle={toggle(setSelectedCollections)} />
              <button
                type="button"
                onClick={() => { focusResultsPending.current = true; setFiltersOpen(false) }}
                className="btn-outline min-h-11 justify-center py-2.5 text-xs sm:hidden"
              >
                Show {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
              </button>
            </div>
          </div>
        </div>

        <p ref={resultsRef} tabIndex={-1} className="mt-5 scroll-mt-24 text-sm text-sand focus:outline-none sm:mt-6" role="status" aria-atomic="true">
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'} found
          {filtered.length > 0 && <span className="ml-2 text-xs text-sand/80">· Showing {currentPage.start}–{currentPage.end}</span>}
        </p>
        {filtered.length === 0 ? (
          <div className="mt-5">
            <EmptyState onClear={() => { setCat('all'); clearAllFilters() }} />
          </div>
        ) : (
          <>
            <div ref={cardsRef} className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-5 lg:grid-cols-3">
              {currentPage.items.map((p) => (
                <motion.div
                  key={p.id}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.fast, ease: MOTION_EASE }}
                >
                  <ProductCard product={p} onOpen={setOpen} onViewIn3D={onViewIn3D} />
                </motion.div>
              ))}
            </div>
            {currentPage.pageCount > 1 && (
              <nav ref={paginationRef} aria-label="Catalogue result pages" className="mt-6 flex items-center justify-center gap-3 sm:mt-8 sm:gap-5">
                <button
                  type="button"
                  disabled={currentPage.pageIndex === 0}
                  onClick={() => changePage(currentPage.pageIndex - 1)}
                  className="btn-outline min-h-11 px-3 py-2.5 text-xs disabled:pointer-events-none disabled:opacity-35 sm:px-5"
                >
                  Previous
                </button>
                <span className="text-xs tabular-nums text-sand">Page {currentPage.pageIndex + 1} of {currentPage.pageCount}</span>
                <button
                  type="button"
                  disabled={currentPage.pageIndex >= currentPage.pageCount - 1}
                  onClick={() => changePage(currentPage.pageIndex + 1)}
                  className="btn-outline min-h-11 px-3 py-2.5 text-xs disabled:pointer-events-none disabled:opacity-35 sm:px-5"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
        <p className="mt-5 text-center">
          <a href="/catalogue/" className="inline-flex min-h-11 items-center text-xs text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            Browse all catalogue pages
          </a>
        </p>
      </div>

      <AnimatePresence>
        {open && (
          <ProductLightbox
            product={open}
            onClose={() => setOpen(null)}
            onViewIn3D={onViewIn3D}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
