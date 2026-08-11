import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

const PAGE_SIZE = 24

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
// it. Options that would return nothing are hidden entirely.
// ---------------------------------------------------------------------------

const SURFACE_OPTIONS = ['Floor', 'Wall', 'Countertop']

export default function Catalogue() {
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedSurfaces, setSelectedSurfaces] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])
  const [selectedFinishes, setSelectedFinishes] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])

  const [open, setOpen] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const clearAllFilters = () => {
    setQuery('')
    setSelectedColors([])
    setSelectedSurfaces([])
    setSelectedSizes([])
    setSelectedFinishes([])
    setSelectedCollections([])
  }

  // Listen for "filter-catalogue" events from the ProductCategories section —
  // clicking a category card scrolls here and pre-selects that filter.
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail) return
      setCat(e.detail)
      clearAllFilters()
    }
    window.addEventListener('filter-catalogue', handler)
    return () => window.removeEventListener('filter-catalogue', handler)
  }, [])

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

  // Build option lists with contextual counts. Each facet counts over the set
  // matching every other facet, which is what makes a pill's number equal the
  // result you get by clicking it.
  const colorOptions = useMemo(() => {
    const pool = matchAllExcept('color')
    const counts = {}
    for (const p of pool) { const c = colorOf(p); if (c) counts[c] = (counts[c] || 0) + 1 }
    return Object.keys(COLOR_SWATCHES)
      .map((c) => ({ value: c, label: c, count: counts[c] || 0, dot: COLOR_SWATCHES[c] }))
      .sort((a, b) => b.count - a.count)
  }, [matchAllExcept])

  const surfaceOptions = useMemo(() => {
    const pool = matchAllExcept('surface')
    const counts = {}
    for (const p of pool) for (const s of surfacesOfProduct(p)) counts[s] = (counts[s] || 0) + 1
    return SURFACE_OPTIONS.map((s) => ({ value: s, label: s, count: counts[s] || 0 }))
  }, [matchAllExcept])

  const sizeOptions = useMemo(() => {
    const pool = matchAllExcept('size')
    const counts = {}
    for (const p of pool) { const s = normalizeSize(p.size); if (s) counts[s] = (counts[s] || 0) + 1 }
    return Object.entries(counts)
      .map(([value, count]) => {
        const sample = products.find((p) => normalizeSize(p.size) === value)
        const trade = sizeTrade(sample?.size)
        return {
          value,
          label: trade ? `${sizeLabel(sample?.size)} · ${trade}` : sizeLabel(sample?.size),
          count,
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [matchAllExcept])

  const finishOptions = useMemo(() => {
    const pool = matchAllExcept('finish')
    const counts = {}
    for (const p of pool) if (p.finish) counts[p.finish] = (counts[p.finish] || 0) + 1
    return Object.entries(counts)
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count)
  }, [matchAllExcept])

  const collectionOptions = useMemo(() => {
    const pool = matchAllExcept('collection')
    const counts = {}
    for (const p of pool) { const c = collectionOf(p); if (c) counts[c.id] = (counts[c.id] || 0) + 1 }
    return Object.entries(counts)
      .map(([value, count]) => ({ value, label: collectionLabel(value), count }))
      .sort((a, b) => b.count - a.count)
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

  // Rendering all 550+ products at once is a real DOM/layout cost on low-end
  // mobile CPUs, so only mount PAGE_SIZE at a time and grow with "Load more".
  // Reset back to the first page whenever the result set changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filtered])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const onViewIn3D = () => {
    // 3D visualizer removed — scroll to 2D room visualizer in its place
    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' })
  }

  const toggle = (setter) => (value) =>
    setter((list) => (list.includes(value) ? list.filter((i) => i !== value) : [...list, value]))

  const activeFilterCount =
    selectedColors.length + selectedSurfaces.length + selectedSizes.length +
    selectedFinishes.length + selectedCollections.length + (query.trim() ? 1 : 0)

  return (
    <section id="catalogue" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Our Collection"
          title="Browse the Catalogue"
          subtitle="Search by tile name or code, or narrow by colour, surface, size and finish. Click any product for full specs and to ask about availability on WhatsApp."
        />
        <div className="mt-12">
          <CategoryTabs active={cat} onChange={setCat} counts={categoryCounts} />

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/5 bg-charcoal-800/50 p-5 backdrop-blur-sm"
          >
            {/* Search first: it is the fastest path for anyone who already
                knows the tile name or code, and it narrows every facet below. */}
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand/40"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, code or size — e.g. “Anilaz”, “gt-floor-c001”, “600x1200”"
                aria-label="Search the catalogue"
                className="w-full rounded-btn border border-white/10 bg-charcoal-900/60 py-2.5 pl-10 pr-9 text-sm text-cream placeholder:text-sand/40 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-sand/50 hover:bg-white/10 hover:text-cream"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cream">Filters</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gold transition-colors hover:text-gold-light"
                >
                  Clear all ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <FilterGroup label="Colour" options={colorOptions} selected={selectedColors} onToggle={toggle(setSelectedColors)} />
              <FilterGroup label="Surface" options={surfaceOptions} selected={selectedSurfaces} onToggle={toggle(setSelectedSurfaces)} />
              <FilterGroup label="Size" options={sizeOptions} selected={selectedSizes} onToggle={toggle(setSelectedSizes)} />
              <FilterGroup label="Finish" options={finishOptions} selected={selectedFinishes} onToggle={toggle(setSelectedFinishes)} />
              <FilterGroup label="Range" options={collectionOptions} selected={selectedCollections} onToggle={toggle(setSelectedCollections)} />
            </div>
          </motion.div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10">
            <EmptyState onClear={() => { setCat('all'); clearAllFilters() }} />
          </div>
        ) : (
          <>
            <motion.div layout className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {visible.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProductCard product={p} onOpen={setOpen} onViewIn3D={onViewIn3D} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <div className="mt-8 flex flex-col items-center gap-2">
              <p className="text-xs text-sand/60">
                Showing {visible.length} of {filtered.length} products
              </p>
              {hasMore && (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="btn-outline px-6 py-2.5 text-xs"
                >
                  Load more
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <ProductLightbox
            product={open}
            onClose={() => setOpen(null)}
            onViewIn3D={(p) => { setOpen(null); onViewIn3D(p) }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
