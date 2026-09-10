import { Suspense, lazy, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import CanvasFallback from '../ui/CanvasFallback'
import Logo3D from '../three/Logo3D'
import { business } from '../../data/siteConfig'
import { swatches } from '../../data/products'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'
import { usePageVisible } from '../../hooks/usePageVisible'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const TileWall3D = lazy(() => import('../three/TileWall3D'))

const fallbackSwatches = swatches.slice(0, 9)

export default function Hero() {
  const webgl = useWebGL()
  const pageVisible = usePageVisible()
  const reduce = useReducedMotion()
  const scrollRef = useRef(0)
  // Above the fold, so start visible; pause the render loop once the hero
  // scrolls out of view.
  const [stageRef, , heroVisible] = useInView({ rootMargin: '0px', initial: true })
  const active = heroVisible && pageVisible

  useEffect(() => {
    if (!active || reduce) return
    const onScroll = () => {
      const vh = window.innerHeight || 1
      scrollRef.current = Math.min(1, Math.max(0, window.scrollY / vh))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [active, reduce])

  return (
    <section id="home" className="relative min-h-[100svh] w-full overflow-hidden">
      {/* 3D background tile wall / fallback layer */}
      <div ref={stageRef} className="absolute inset-0">
        {webgl ? (
          <Suspense fallback={<div className="h-full w-full bg-charcoal" />}>
            <TileWall3D
              scrollRef={scrollRef}
              frameloop={active ? 'always' : 'never'}
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

      {/* Keep fine gold text readable over even the lightest tile swatches. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-charcoal/45 via-charcoal/55 to-charcoal/90" />

      {/* ─── Hero Content: 3D Animated Logo ────────────────────────── */}
      <div className="container-px relative z-10 flex min-h-[100svh] flex-col items-center justify-center pt-20 pb-28">

        {/* 3D Logo — CSS 3D transforms + framer-motion animation */}
        <Reveal>
          <div className="relative flex w-full max-w-4xl items-center justify-center py-6">
            <Logo3D active={active} />
          </div>
        </Reveal>

        <h1 className="mt-4 max-w-2xl text-center font-display text-xl text-cream sm:text-2xl">
          Tiles, stone &amp; sanitaryware in Nuapada
        </h1>

        {/* Tagline */}
        <Reveal delay={0.1}>
          <p className="mt-6 text-center font-display text-xl italic text-gold-light sm:text-2xl lg:text-3xl">
            &ldquo;{business.tagline}&rdquo;
          </p>
        </Reveal>

        {/* CTA Buttons */}
        <Reveal delay={0.16}>
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
        <Reveal delay={0.22}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-sand/80">
            <span className="inline-flex items-center gap-2">
              <Icon name="clock" className="h-4 w-4 text-gold" />
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
        animate={active && !reduce ? { y: [0, 6, 0] } : { y: 0 }}
        transition={active && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        aria-label="Scroll to collection"
      >
        <Icon name="arrowDown" className="h-6 w-6" />
      </motion.a>
    </section>
  )
}
