import { Suspense, lazy, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import CanvasFallback from '../ui/CanvasFallback'
import { business } from '../../data/siteConfig'
import { swatches } from '../../data/products'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'

const TileWall3D = lazy(() => import('../three/TileWall3D'))
const Logo3D = lazy(() => import('../three/Logo3D'))

const fallbackSwatches = swatches.slice(0, 9)

// ─── 2D Fallback Logo (for non-WebGL devices) ──────────────────────
function LogoFallback() {
  return (
    <div className="flex items-center gap-6">
      {/* Gradient disc with emblem */}
      <div
        className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full sm:h-36 sm:w-36 lg:h-44 lg:w-44"
        style={{
          background: 'radial-gradient(circle at 40% 35%, #F5A623 0%, #F08C18 30%, #E8601A 60%, #C23616 100%)',
          boxShadow: '0 0 60px -10px rgba(240, 140, 24, 0.5)',
        }}
      >
        {/* Simplified Ganesh S symbol */}
        <svg viewBox="0 0 60 60" className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24" fill="none">
          <path
            d="M30 8 C38 8 44 14 43 22 C42 28 36 30 33 26 C28 20 22 24 24 32 C26 40 34 42 34 48 C34 54 28 56 22 52 C16 48 14 40 18 34 C22 28 28 32 24 36 C18 42 16 38 16 28 C16 18 22 8 30 8Z"
            fill="white"
            opacity="0.95"
          />
          <circle cx="38" cy="18" r="3" fill="white" opacity="0.9" />
        </svg>
      </div>
      {/* Text */}
      <div>
        <div className="font-sans text-3xl font-bold leading-tight text-charcoal sm:text-4xl lg:text-5xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
          siddhi
        </div>
        <div className="font-sans text-3xl font-bold leading-tight text-charcoal sm:text-4xl lg:text-5xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
          vinayak
        </div>
        <div className="mt-1 text-sm font-normal tracking-[0.35em] text-charcoal/80 sm:text-base lg:text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
          TILES
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  const webgl = useWebGL()
  const scrollRef = useRef(0)
  // Above the fold, so start visible; pause the render loop once the hero
  // scrolls out of view.
  const [stageRef, , heroVisible] = useInView({ rootMargin: '0px', initial: true })

  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight || 1
      scrollRef.current = Math.min(1, Math.max(0, window.scrollY / vh))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section id="home" className="relative min-h-[100svh] w-full overflow-hidden">
      {/* 3D background tile wall / fallback layer */}
      <div ref={stageRef} className="absolute inset-0">
        {webgl ? (
          <Suspense fallback={<div className="h-full w-full bg-charcoal" />}>
            <TileWall3D
              scrollRef={scrollRef}
              frameloop={heroVisible ? 'always' : 'never'}
            />
          </Suspense>
        ) : (
          <div className="relative h-full w-full bg-charcoal">
            <div className="absolute inset-0 opacity-50">
              <CanvasFallback swatchList={fallbackSwatches} className="h-full" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-charcoal/40 via-charcoal/70 to-charcoal" />
          </div>
        )}
      </div>

      {/* readability gradient — lighter at center to let the 3D logo shine */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-charcoal/40 via-transparent to-charcoal/90" />

      {/* ─── Hero Content: 3D Animated Logo ────────────────────────── */}
      <div className="container-px relative z-10 flex min-h-[100svh] flex-col items-center justify-center pt-20 pb-28">

        {/* 3D Logo — CSS 3D transforms + framer-motion animation */}
        <Reveal>
          <div className="relative flex w-full max-w-4xl items-center justify-center py-6">
            <Suspense
              fallback={
                <div className="flex items-center justify-center">
                  <LogoFallback />
                </div>
              }
            >
              <Logo3D />
            </Suspense>
          </div>
        </Reveal>

        {/* Tagline */}
        <Reveal delay={0.24}>
          <p className="mt-6 text-center font-display text-xl italic text-gold-light sm:text-2xl lg:text-3xl">
            &ldquo;{business.tagline}&rdquo;
          </p>
        </Reveal>

        {/* CTA Buttons */}
        <Reveal delay={0.32}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a href="#products" className="btn-gold">
              Explore Collection
              <Icon name="arrowDown" className="h-4 w-4" />
            </a>
            <a href={`tel:${business.phoneTel}`} className="btn-outline">
              <Icon name="phone" className="h-4 w-4" />
              {business.phoneDisplay}
            </a>
          </div>
        </Reveal>

        {/* Business hours & location */}
        <Reveal delay={0.4}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-sand/80">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              {business.hours.label} · {business.hours.time}
            </span>
            <span className="inline-flex items-center gap-2">
              <Icon name="mapPin" className="h-4 w-4 text-gold" />
              {business.address.city}, {business.address.state}
            </span>
          </div>
        </Reveal>
      </div>

      {/* scroll cue */}
      <motion.a
        href="#products"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-sand/70"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        aria-label="Scroll to collection"
      >
        <Icon name="arrowDown" className="h-6 w-6" />
      </motion.a>
    </section>
  )
}
