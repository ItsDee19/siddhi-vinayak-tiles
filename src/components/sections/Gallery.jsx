import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import SectionHeading from '../ui/SectionHeading'
import SwatchThumb from '../ui/SwatchThumb'
import { galleryItems, categories } from '../../data/products'

const filters = [{ id: 'all', name: 'All' }, ...categories]

export default function Gallery() {
  const [active, setActive] = useState('all')
  const [lightbox, setLightbox] = useState(null)

  // Respond to "view in gallery" clicks from the category cards.
  useEffect(() => {
    const handler = (e) => setActive(e.detail || 'all')
    window.addEventListener('filter-gallery', handler)
    return () => window.removeEventListener('filter-gallery', handler)
  }, [])

  const items = useMemo(
    () =>
      active === 'all'
        ? galleryItems
        : galleryItems.filter((g) => g.category === active),
    [active],
  )

  // lightbox keyboard nav
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = items.findIndex((i) => i.id === lightbox.id)
        const next =
          e.key === 'ArrowRight'
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length
        setLightbox(items[next])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, items])

  return (
    <section id="gallery" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Inspiration Gallery"
          title="A Closer Look"
          subtitle="Browse sample finishes by category. These are placeholder renders — real showroom photos will replace them."
        />

        {/* filter pills */}
        <div className="mt-12 flex flex-wrap justify-center gap-2.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                active === f.id
                  ? 'bg-gold text-charcoal shadow-glow'
                  : 'bg-white/5 text-sand hover:bg-white/10'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* masonry-ish grid */}
        <motion.div
          layout
          className="mt-12 grid auto-rows-[200px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.button
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35 }}
                onClick={() => setLightbox(item)}
                className={`group relative overflow-hidden rounded-2xl border border-white/5 shadow-card ${
                  item.featured ? 'row-span-2' : ''
                }`}
              >
                <SwatchThumb
                  swatch={item}
                  size={item.featured ? 384 : 256}
                  className="h-full w-full transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-transparent to-transparent opacity-80" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-left">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gold">
                      {categories.find((c) => c.id === item.category)?.name}
                    </span>
                    <p className="font-display text-base text-cream">
                      {item.title}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 translate-y-2 place-items-center rounded-full bg-gold/90 text-charcoal opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/90 p-4 backdrop-blur-sm"
          >
            <button
              className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-cream hover:bg-white/20"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-charcoal-800 shadow-card"
            >
              <SwatchThumb
                swatch={lightbox}
                size={640}
                eager
                className="aspect-video w-full"
              />
              <div className="flex items-center justify-between p-6">
                <div>
                  <span className="text-xs uppercase tracking-wider text-gold">
                    {categories.find((c) => c.id === lightbox.category)?.name}
                  </span>
                  <h3 className="font-display text-2xl text-cream">
                    {lightbox.title}
                  </h3>
                </div>
                <span className="rounded-full border border-sand/30 px-3 py-1 text-[10px] uppercase tracking-wider text-sand/70">
                  Placeholder render
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
