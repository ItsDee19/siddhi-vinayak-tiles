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

const fallbackSwatches = swatches.slice(0, 9)

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
      {/* 3D / fallback layer */}
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

      {/* readability gradient over 3D */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/20 to-charcoal" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-charcoal/80 via-transparent to-transparent" />

      {/* content */}
      <div className="container-px relative z-10 flex min-h-[100svh] flex-col justify-center pt-24 pb-28">
        <Reveal>
          <span className="eyebrow">
            <span className="h-px w-8 bg-gold" />
            Nuapada, Odisha · Since the family began
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="heading-display mt-5 max-w-4xl text-balance text-5xl text-cream sm:text-6xl lg:text-7xl xl:text-8xl">
            Siddhi Vinayak{' '}
            <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">
              Tiles
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-5 max-w-xl text-lg text-sand sm:text-xl">
            {business.intro}
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <p className="mt-6 font-display text-xl italic text-gold-light sm:text-2xl">
            “{business.tagline}”
          </p>
        </Reveal>

        <Reveal delay={0.32}>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#products" className="btn-gold">
              Explore Collection
              <Icon name="arrowDown" className="h-4 w-4" />
            </a>
            <a href={`tel:${business.phoneTel}`} className="btn-outline">
              <Icon name="phone" className="h-4 w-4" />
              {business.phoneDisplay}
            </a>
            <a href="#visualizer" className="btn-outline">
              <Icon name="tiles" className="h-4 w-4" />
              3D Visualizer
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.4}>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-sand/80">
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
