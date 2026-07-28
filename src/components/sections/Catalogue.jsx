import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SectionHeading from '../ui/SectionHeading'
import CategoryTabs from '../catalogue/CategoryTabs'
import SubCategoryStrip from '../catalogue/SubCategoryStrip'
import ProductCard from '../catalogue/ProductCard'
import ProductLightbox from '../catalogue/ProductLightbox'
import EmptyState from '../catalogue/EmptyState'
import { products, colorFamilies, getColorFamily } from '../../data/catalogue'

const PAGE_SIZE = 24

export default function Catalogue() {
  const [cat, setCat] = useState('all')
  const [sub, setSub] = useState(null)
  
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedFinishes, setSelectedFinishes] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])

  const [open, setOpen] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Listen for "filter-catalogue" events from the ProductCategories section —
  // clicking a category card scrolls here and pre-selects that filter.
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail) return
      setCat(e.detail)
      setSub(null)
      setSelectedColors([])
      setSelectedFinishes([])
      setSelectedSizes([])
    }
    window.addEventListener('filter-catalogue', handler)
    return () => window.removeEventListener('filter-catalogue', handler)
  }, [])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (cat !== 'all' && p.category.toLowerCase() !== cat) return false
      if (sub && p.subCategory !== sub) return false
      
      if (selectedFinishes.length > 0 && !selectedFinishes.includes(p.finish)) return false
      if (selectedSizes.length > 0 && !selectedSizes.includes(p.size)) return false
      
      if (selectedColors.length > 0) {
        const pFamily = getColorFamily(p.color)
        if (!selectedColors.includes(pFamily)) return false
      }
      
      return true
    })
  }, [cat, sub, selectedFinishes, selectedSizes, selectedColors])

  // Rendering all 400+ products at once is a real DOM/layout cost on
  // low-end mobile CPUs, so only mount PAGE_SIZE at a time and grow with
  // "Load more". Reset back to the first page whenever the filter changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [cat, sub, selectedFinishes, selectedSizes, selectedColors])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const onViewIn3D = (p) => {
    // Tell the Visualizer to load this texture
    window.dispatchEvent(new CustomEvent('view-in-3d', { detail: p }))
    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Extract available filters statically or dynamically
  const availableSizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))), [])
  const availableFinishes = useMemo(() => Array.from(new Set(products.map(p => p.finish).filter(Boolean))), [])
  const availableColors = Object.keys(colorFamilies).filter(c => c !== 'Multi')

  const toggleFilter = (setter, list, item) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item))
    } else {
      setter([...list, item])
    }
  }

  const clearAllFilters = () => {
    setSelectedColors([])
    setSelectedFinishes([])
    setSelectedSizes([])
  }

  const activeFilterCount = selectedColors.length + selectedFinishes.length + selectedSizes.length

  const FilterPill = ({ active, onClick, children, dotColor }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap
        ${active 
          ? 'bg-gold/20 border border-gold text-gold shadow-[0_0_10px_rgba(196,154,60,0.2)]' 
          : 'bg-charcoal-700 border border-white/10 text-sand/70 hover:bg-charcoal-600 hover:text-cream'
        }
      `}
    >
      {dotColor && (
        <span 
          className="w-2.5 h-2.5 rounded-full border border-white/20"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {children}
    </button>
  )

  return (
    <section id="catalogue" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Our Collection"
          title="Browse the Catalogue"
          subtitle="Filter by category, sub-type and finish. Click any product to see full specs and ask for availability on WhatsApp."
        />
        <div className="mt-12">
          <CategoryTabs active={cat} onChange={(c) => { setCat(c); setSub(null) }} />
          <SubCategoryStrip category={cat} active={sub} onChange={setSub} />
          
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-col gap-4 border border-white/5 rounded-2xl p-5 bg-charcoal-800/50 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cream">Filters</h3>
              {activeFilterCount > 0 && (
                <button 
                  onClick={clearAllFilters}
                  className="text-xs text-gold hover:text-gold-light transition-colors"
                >
                  Clear All ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 overflow-x-auto pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-hide">
              {/* Colors */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-sand/50 uppercase tracking-wider min-w-[60px]">Color</span>
                <div className="flex gap-2">
                  {availableColors.map(c => (
                    <FilterPill
                      key={c}
                      active={selectedColors.includes(c)}
                      onClick={() => toggleFilter(setSelectedColors, selectedColors, c)}
                      dotColor={colorFamilies[c]}
                    >
                      {c}
                    </FilterPill>
                  ))}
                </div>
              </div>

              {/* Finish */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-sand/50 uppercase tracking-wider min-w-[60px]">Finish</span>
                <div className="flex gap-2">
                  {availableFinishes.map(f => (
                    <FilterPill
                      key={f}
                      active={selectedFinishes.includes(f)}
                      onClick={() => toggleFilter(setSelectedFinishes, selectedFinishes, f)}
                    >
                      {f}
                    </FilterPill>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-sand/50 uppercase tracking-wider min-w-[60px]">Size</span>
                <div className="flex gap-2">
                  {availableSizes.map(s => (
                    <FilterPill
                      key={s}
                      active={selectedSizes.includes(s)}
                      onClick={() => toggleFilter(setSelectedSizes, selectedSizes, s)}
                    >
                      {s}
                    </FilterPill>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10">
            <EmptyState onClear={() => { setCat('all'); setSub(null); clearAllFilters(); }} />
          </div>
        ) : (
          <>
            <motion.div 
              layout
              className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
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
                    <ProductCard
                      product={p}
                      onOpen={setOpen}
                      onViewIn3D={onViewIn3D}
                    />
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
