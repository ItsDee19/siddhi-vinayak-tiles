import { Suspense, lazy } from 'react'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SwatchThumb from '../ui/SwatchThumb'
import { business } from '../../data/siteConfig'
import { swatches } from '../../data/products'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'

const Slab3D = lazy(() => import('../three/Slab3D'))

const aboutPoints = [
  'Hand-picked tiles, marble, granite, quartz & sanitaryware',
  'Personal guidance from a family that knows the trade',
  'Fair, transparent pricing — no pressure, ever',
]

export default function About() {
  const webgl = useWebGL()
  const [slabRef, slabEntered, slabVisible] = useInView({ rootMargin: '300px' })
  const slabSwatch = swatches.find((s) => s.id === 'marble-statuario')

  return (
    <section id="about" className="section-pad relative overflow-hidden bg-charcoal-800">
      {/* warm accent glow */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />

      <div className="container-px grid items-center gap-14 lg:grid-cols-2">
        {/* slab visual */}
        <Reveal>
          <div
            ref={slabRef}
            className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/5 bg-charcoal shadow-card"
          >
            {webgl ? (
              slabEntered ? (
                <Suspense fallback={<div className="h-full w-full bg-charcoal" />}>
                  <Slab3D frameloop={slabVisible ? 'always' : 'never'} />
                </Suspense>
              ) : (
                <div className="h-full w-full bg-charcoal" />
              )
            ) : (
              <SwatchThumb
                swatch={slabSwatch}
                size={600}
                className="h-full w-full"
              />
            )}
            {webgl && (
              <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-charcoal/70 px-3 py-1.5 text-[11px] text-sand backdrop-blur">
                Hover to spin · Statuario Marble
              </span>
            )}
          </div>
        </Reveal>

        {/* story */}
        <div>
          <Reveal>
            <span className="eyebrow">
              <span className="h-px w-8 bg-gold" />
              Our Story
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="heading-display mt-5 text-4xl text-cream sm:text-5xl">
              A Family Showroom in the Heart of Nuapada
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-base leading-relaxed text-sand/85 sm:text-lg">
              {business.name} began with a simple belief — that choosing the
              surfaces for your home should feel personal, not transactional.
              From our showroom at Gayatri Mandir Chowk, we help families across
              Nuapada find tiles and stone they’ll love for decades.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <ul className="mt-7 space-y-3">
              {aboutPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sand">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                    <Icon name="star" className="h-3.5 w-3.5" filled />
                  </span>
                  <span className="text-sm sm:text-base">{p}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* featured quote */}
          <Reveal delay={0.2}>
            <blockquote className="mt-9 rounded-2xl border-l-2 border-gold bg-gradient-to-r from-gold/10 to-transparent p-6">
              <p className="font-display text-2xl italic text-gold-light sm:text-3xl">
                “{business.tagline}”
              </p>
              <footer className="mt-2 text-sm text-sand/70">
                — The promise we keep with every visitor
              </footer>
            </blockquote>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
