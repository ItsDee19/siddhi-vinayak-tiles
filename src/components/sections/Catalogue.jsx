import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import SectionHeading from '../ui/SectionHeading'
import CategoryTabs from '../catalogue/CategoryTabs'
import SubCategoryStrip from '../catalogue/SubCategoryStrip'
import FinishChips from '../catalogue/FinishChips'
import ProductCard from '../catalogue/ProductCard'
import ProductLightbox from '../catalogue/ProductLightbox'
import EmptyState from '../catalogue/EmptyState'
import { products } from '../../data/catalogue'

const PAGE_SIZE = 24

export default function Catalogue() {
  const [cat, setCat] = useState('all')
  const [sub, setSub] = useState(null)
  const [finish, setFinish] = useState(null)
  const [open, setOpen] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Listen for "filter-catalogue" events from the ProductCategories section —
  // clicking a category card scrolls here and pre-selects that filter.
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail) return
      setCat(e.detail)
      setSub(null)
      setFinish(null)
    }
    window.addEventListener('filter-catalogue', handler)
    return () => window.removeEventListener('filter-catalogue', handler)
  }, [])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (cat !== 'all' && p.category.toLowerCase() !== cat) return false
      if (sub && p.subCategory !== sub) return false
      if (finish && p.finish !== finish) return false
      return true
    })
  }, [cat, sub, finish])

  // Rendering all 400+ products at once is a real DOM/layout cost on
  // low-end mobile CPUs, so only mount PAGE_SIZE at a time and grow with
  // "Load more". Reset back to the first page whenever the filter changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [cat, sub, finish])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const onViewIn3D = (p) => {
    // Tell the Visualizer to load this texture
    window.dispatchEvent(new CustomEvent('view-in-3d', { detail: p }))
    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' })
  }

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
          <FinishChips active={finish} onChange={setFinish} />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10">
            <EmptyState onClear={() => { setCat('all'); setSub(null); setFinish(null) }} />
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={setOpen}
                  onViewIn3D={onViewIn3D}
                />
              ))}
            </div>
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
