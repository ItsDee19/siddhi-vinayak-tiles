import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../Icons'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const AUTOPLAY_MS = 4500
const SPRING = { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 }
const DRAG_DISTANCE_THRESHOLD = 60
const DRAG_VELOCITY_THRESHOLD = 500

/**
 * Viewport width, sampled on resize through rAF so a window drag coalesces to
 * one update per frame rather than one per resize event. (Ported from the 2D
 * visualizer this carousel replaced — see archive/2d-visualizer.)
 */
function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  )
  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWidth(window.innerWidth))
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return width
}

// Signed distance from `index` to `activeIndex` around the ring, taking
// whichever direction is shorter — e.g. with 10 slides, going from slide 0 to
// slide 9 is offset -1 (one step back), not +9 (nine steps forward), so
// wrap-around never shows as a full spin across every other slide.
function circularOffset(index, activeIndex, length) {
  let diff = index - activeIndex
  if (diff > length / 2) diff -= length
  if (diff < -length / 2) diff += length
  return diff
}

export default function Coverflow({ slides }) {
  const count = slides.length
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const reduce = useReducedMotion()
  const width = useViewportWidth()
  const mobile = width < 640
  const containerRef = useRef(null)

  const goTo = useCallback((i) => setActiveIndex(((i % count) + count) % count), [count])
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  // Gentle auto-advance — the thing that actually shows off "smooth sliding"
  // to a visitor who never touches the carousel. Paused rather than removed
  // the moment the user shows any intent (hover, focus, drag), disabled
  // outright under reduced-motion or once the carousel scrolls off-screen.
  useEffect(() => {
    if (reduce || paused || dragging || !onScreen || count <= 1) return
    const t = setInterval(() => setActiveIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [reduce, paused, dragging, onScreen, count])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Catalogue product cards dispatch this (see Catalogue.jsx's onViewIn3D,
  // renamed view-in-showcase) so clicking "View in Showcase" on a product
  // that happens to be one of the curated slides jumps straight to it.
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.id
      if (!id) return
      const idx = slides.findIndex((s) => s.product?.id === id)
      if (idx >= 0) setActiveIndex(idx)
    }
    window.addEventListener('view-in-showcase', handler)
    return () => window.removeEventListener('view-in-showcase', handler)
  }, [slides])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    }
  }

  const handleDragEnd = (_e, info) => {
    setDragging(false)
    if (info.offset.x < -DRAG_DISTANCE_THRESHOLD || info.velocity.x < -DRAG_VELOCITY_THRESHOLD) {
      next()
    } else if (info.offset.x > DRAG_DISTANCE_THRESHOLD || info.velocity.x > DRAG_VELOCITY_THRESHOLD) {
      prev()
    }
  }

  const tilt = mobile ? 16 : 32
  const shift = mobile ? 34 : 46

  if (count === 0) return null

  return (
    <div
      ref={containerRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="Tile showcase"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-full w-full select-none outline-none"
      style={{ perspective: mobile ? 900 : 1400 }}
    >
      <motion.div
        className="relative h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
      >
        {slides.map((slide, i) => {
          const offset = circularOffset(i, activeIndex, count)
          const abs = Math.abs(offset)
          const isActive = offset === 0
          const inRange = abs <= 1
          const opacityTarget = inRange ? 1 - abs * 0.45 : 0

          // `opacity` is deliberately NOT in the `animate` object below: on
          // this element framer-motion silently refuses to apply it (every
          // sibling transform/zIndex value animates correctly; opacity alone
          // stays pinned at 1 regardless of target — confirmed by logging the
          // exact value handed to `animate` and comparing it against the
          // rendered inline style, across a fresh unthrottled mount with no
          // other state churn). Setting it as a plain style value sidesteps
          // whatever that is; the CSS `transition-opacity` utility class
          // keeps the crossfade smooth without framer.
          return (
            <motion.button
              key={slide.id}
              type="button"
              aria-label={isActive ? `${slide.title}, current slide` : `Go to ${slide.title}`}
              aria-hidden={!inRange}
              tabIndex={inRange ? 0 : -1}
              onClick={() => !isActive && goTo(i)}
              className={`absolute left-1/2 top-1/2 h-[62%] w-[74%] max-w-[420px] transition-opacity duration-300 ease-out sm:h-[72%] sm:w-[46%] ${
                isActive ? 'cursor-default' : 'cursor-pointer'
              }`}
              style={{
                transformStyle: 'preserve-3d',
                pointerEvents: inRange ? 'auto' : 'none',
                opacity: opacityTarget,
              }}
              animate={{
                x: `calc(-50% + ${offset * shift}%)`,
                y: '-50%',
                rotateY: reduce ? 0 : -Math.sign(offset) * tilt,
                scale: inRange ? 1 - abs * 0.2 : 0.72,
                zIndex: 10 - abs,
              }}
              transition={SPRING}
            >
              <div className="relative h-full w-full overflow-hidden rounded-card border border-white/10 bg-charcoal-800 shadow-card">
                <img
                  src={slide.image}
                  alt={slide.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/15 to-transparent" />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 p-4 transition-opacity duration-300 ease-out sm:p-6"
                  style={{ opacity: isActive ? 1 : 0 }}
                >
                  <h3 className="font-display text-lg text-cream sm:text-2xl">
                    {slide.title}
                  </h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gold sm:text-xs">
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous tile"
            className="glass absolute left-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-btn text-cream transition-colors hover:border-gold hover:text-gold sm:left-4 sm:h-11 sm:w-11"
          >
            <Icon name="arrowRight" className="h-4 w-4 rotate-180 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next tile"
            className="glass absolute right-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-btn text-cream transition-colors hover:border-gold hover:text-gold sm:right-4 sm:h-11 sm:w-11"
          >
            <Icon name="arrowRight" className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center gap-1.5 sm:bottom-4">
            {slides.map((slide, i) => (
              <span
                key={slide.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'w-5 bg-gold' : 'w-1.5 bg-cream/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
