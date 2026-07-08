import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import SectionHeading from '../ui/SectionHeading'
import SwatchThumb from '../ui/SwatchThumb'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { galleryItems, categories } from '../../data/products'

const filters = [{ id: 'all', name: 'All' }, ...categories]

export default function Gallery() {
  const [active, setActive] = useState('all')
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(null)
  const [paused, setPaused] = useState(false)
  const [stageW, setStageW] = useState(0)
  const [inView, setInView] = useState(false)

  const carouselRef = useRef(null)
  const stageRef = useRef(null)
  const swipe = useRef({ x: 0, down: false, moved: false })
  const reduce = useReducedMotion()

  const items = useMemo(
    () =>
      active === 'all'
        ? galleryItems
        : galleryItems.filter((g) => g.category === active),
    [active],
  )

  const count = items.length
  // Guard against the one frame after a filter change where `index` may still
  // point past the newly filtered list (the reset effect runs just after).
  const safeIndex = index < count ? index : 0
  const current = items[safeIndex] || items[0]

  // Respond to "view in gallery" clicks from the category cards.
  useEffect(() => {
    const handler = (e) => setActive(e.detail || 'all')
    window.addEventListener('filter-gallery', handler)
    return () => window.removeEventListener('filter-gallery', handler)
  }, [])

  // Reset to the first slide whenever the filter changes.
  useEffect(() => {
    setIndex(0)
  }, [active])

  // Track whether the carousel is on-screen so autoplay only runs when the
  // user can actually see it (no backstop — genuinely visible or paused).
  useEffect(() => {
    const el = carouselRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Track stage width so card spacing scales with the viewport.
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) =>
      setStageW(entry.contentRect.width),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const go = useCallback(
    (dir) => setIndex((i) => (i + dir + count) % count),
    [count],
  )

  // Autoplay — gently advances while the carousel is on-screen, pausing on
  // hover, drag, lightbox, when scrolled out of view, or under a reduced-motion
  // preference, so it never fights the user or burns CPU off-screen.
  useEffect(() => {
    if (!inView || paused || lightbox || count <= 1 || reduce) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 3800)
    return () => clearInterval(t)
  }, [inView, paused, lightbox, count])

  // Keyboard nav: arrows drive the carousel; lightbox has its own handler.
  useEffect(() => {
    if (lightbox) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, go])

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

  // Pointer-driven swipe. We only treat a gesture as a swipe past a small
  // threshold, so taps still register as clicks on the cards.
  const onPointerDown = (e) => {
    swipe.current = { x: e.clientX, down: true, moved: false }
    setPaused(true)
  }
  const onPointerMove = (e) => {
    if (swipe.current.down && Math.abs(e.clientX - swipe.current.x) > 8)
      swipe.current.moved = true
  }
  const endPointer = (e) => {
    if (!swipe.current.down) return
    const dx = (e.clientX ?? swipe.current.x) - swipe.current.x
    swipe.current.down = false
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  const onCardClick = (i, offset) => {
    if (swipe.current.moved) return // it was a swipe, not a tap
    if (offset === 0) setLightbox(items[i])
    else setIndex(i)
  }

  // Cards within ±2 of the active slide are rendered for the coverflow depth.
  const spread = Math.min(stageW * 0.42, 360)

  return (
    <section id="gallery" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Inspiration Gallery"
          title="A Closer Look"
          subtitle="Swipe, drag or use the arrows to browse sample finishes. Tap the centre tile to enlarge it. These are placeholder renders — real showroom photos will replace them."
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

        {/* coverflow carousel */}
        <div
          ref={carouselRef}
          className="relative mt-14 select-none"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={stageRef}
            className="relative mx-auto h-[340px] w-full max-w-5xl touch-pan-y sm:h-[420px]"
            style={{ perspective: 1400 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerLeave={endPointer}
            onPointerCancel={endPointer}
          >
            {items.map((item, i) => {
              let offset = i - safeIndex
              if (offset > count / 2) offset -= count
              if (offset < -count / 2) offset += count
              const abs = Math.abs(offset)
              if (abs > 2) return null

              const isActive = offset === 0
              return (
                <motion.div
                  key={item.id}
                  className={`absolute left-1/2 top-1/2 w-[78%] max-w-[440px] sm:w-[60%] ${
                    isActive ? 'cursor-zoom-in' : 'cursor-pointer'
                  }`}
                  style={{ transformStyle: 'preserve-3d' }}
                  initial={false}
                  animate={{
                    x: offset * spread,
                    y: '-50%',
                    translateX: '-50%',
                    scale: isActive ? 1 : 0.82 - (abs - 1) * 0.08,
                    rotateY: reduce ? 0 : offset * -22,
                    opacity: isActive ? 1 : 0.55 - (abs - 1) * 0.22,
                    zIndex: 30 - abs,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                  onClick={() => onCardClick(i, offset)}
                >
                  <div
                    className={`group relative aspect-[4/3] overflow-hidden rounded-3xl border shadow-card transition-colors ${
                      isActive ? 'border-gold/40' : 'border-white/5'
                    }`}
                  >
                    <SwatchThumb
                      swatch={item}
                      size={isActive ? 640 : 384}
                      eager={abs <= 1}
                      className="h-full w-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/10 to-transparent" />

                    {/* caption */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-left">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-gold">
                          {categories.find((c) => c.id === item.category)?.name}
                        </span>
                        <p className="font-display text-lg text-cream sm:text-xl">
                          {item.title}
                        </p>
                      </div>
                      {isActive && (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/90 text-charcoal opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <Icon name="search" className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    {/* dim non-active cards a touch more */}
                    {!isActive && (
                      <div className="absolute inset-0 bg-charcoal/30" />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* arrows */}
          {count > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Previous"
                className="absolute left-1 top-1/2 z-40 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-charcoal/70 text-cream backdrop-blur transition-all hover:border-gold hover:text-gold sm:left-3 lg:-left-2"
              >
                <Icon name="arrowRight" className="h-5 w-5 rotate-180" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next"
                className="absolute right-1 top-1/2 z-40 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-charcoal/70 text-cream backdrop-blur transition-all hover:border-gold hover:text-gold sm:right-3 lg:-right-2"
              >
                <Icon name="arrowRight" className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* counter + dots */}
        {count > 1 && (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-sand/70">
              <span className="font-display text-gold">
                {String(safeIndex + 1).padStart(2, '0')}
              </span>
              <span className="mx-2 text-sand/30">/</span>
              {String(count).padStart(2, '0')}
              <span className="ml-3 text-sand/50">{current?.title}</span>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to ${item.title}`}
                  className={`h-2 rounded-full transition-all ${
                    i === safeIndex
                      ? 'w-7 bg-gold'
                      : 'w-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
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
