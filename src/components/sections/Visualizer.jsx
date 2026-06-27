import { Suspense, lazy, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import SectionHeading from '../ui/SectionHeading'
import SwatchThumb from '../ui/SwatchThumb'
import CanvasFallback from '../ui/CanvasFallback'
import { swatches, categories } from '../../data/products'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'

const Room3D = lazy(() => import('../three/Room3D'))

// Categories that make sense as a floor surface in the visualizer.
const visualizerCats = categories.filter((c) =>
  ['tiles', 'marble', 'granite', 'quartz'].includes(c.id),
)

export default function Visualizer() {
  const webgl = useWebGL()
  const [stageRef, stageEntered, stageVisible] = useInView({ rootMargin: '300px' })
  const [activeCat, setActiveCat] = useState('tiles')
  const [selected, setSelected] = useState(
    swatches.find((s) => s.category === 'tiles') || swatches[0],
  )

  const visible = useMemo(
    () => swatches.filter((s) => s.category === activeCat),
    [activeCat],
  )

  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="See It Before You Buy"
          title="Interactive Tile Visualizer"
          subtitle="Pick a material and watch the room floor change in real time. Drag to look around, scroll to zoom — preview the look before you visit."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* 3D room */}
          <div
            ref={stageRef}
            className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/5 bg-charcoal-800 shadow-card lg:aspect-auto lg:min-h-[520px]"
          >
            {webgl ? (
              stageEntered ? (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sand/60">
                      <span className="animate-pulse">Loading room…</span>
                    </div>
                  }
                >
                  <Room3D
                    swatch={selected}
                    frameloop={stageVisible ? 'always' : 'never'}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sand/50">
                  <span className="animate-pulse">Preparing 3D room…</span>
                </div>
              )
            ) : (
              <div className="relative h-full w-full p-4">
                <CanvasFallback swatchList={visible.slice(0, 6)} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal to-transparent p-4 text-center text-xs text-sand/70">
                  3D preview unavailable on this device — showing material samples
                </div>
              </div>
            )}

            {/* controls hint */}
            {webgl && (
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-charcoal/70 px-3 py-1.5 text-[11px] text-sand backdrop-blur">
                <Icon name="compass" className="h-3.5 w-3.5 text-gold" />
                Drag to orbit · Scroll to zoom
              </div>
            )}

            {/* current selection badge */}
            <div className="absolute bottom-4 left-4 rounded-xl bg-charcoal/80 px-4 py-2 backdrop-blur">
              <span className="text-[10px] uppercase tracking-wider text-gold">
                Now showing
              </span>
              <p className="font-display text-lg text-cream">{selected.name}</p>
            </div>
          </div>

          {/* swatch picker */}
          <div className="rounded-3xl border border-white/5 bg-charcoal-800 p-6 shadow-card">
            <h3 className="font-display text-xl text-cream">Choose a Material</h3>

            {/* category tabs */}
            <div className="mt-5 flex flex-wrap gap-2">
              {visualizerCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                    activeCat === c.id
                      ? 'bg-gold text-charcoal'
                      : 'bg-white/5 text-sand hover:bg-white/10'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* swatches */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
              >
                {visible.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`group overflow-hidden rounded-xl border-2 text-left transition-all ${
                      selected.id === s.id
                        ? 'border-gold shadow-glow'
                        : 'border-transparent hover:border-sand/30'
                    }`}
                  >
                    <SwatchThumb swatch={s} className="aspect-[4/3] w-full" />
                    <span className="block bg-charcoal-700 px-2.5 py-2 text-xs font-medium text-sand">
                      {s.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>

            <p className="mt-6 rounded-xl bg-white/[0.03] p-4 text-xs leading-relaxed text-sand/70">
              Swatches are sample renders. Visit the showroom to see the real
              finish, thickness and size options in person.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
