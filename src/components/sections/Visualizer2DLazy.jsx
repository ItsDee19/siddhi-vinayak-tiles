import { Suspense, lazy, useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import SectionHeading from '../ui/SectionHeading'

const Visualizer2D = lazy(() => import('./Visualizer2D'))

function hashWantsVisualizer() {
  if (typeof window === 'undefined') return false
  return (window.location.hash || '').includes('visualizer')
}

function Placeholder({ innerRef }) {
  return (
    <section
      ref={innerRef}
      id="visualizer"
      className="section-pad relative bg-charcoal"
    >
      <div className="container-px">
        <SectionHeading
          eyebrow="Room Preview"
          title="Tile Visualizer"
          subtitle="Apply real catalogue tiles onto lifestyle room photos."
        />
        {/* Mirrors the mounted visualiser's full-bleed canvas — same negative
            gutters, same 16:9, same height cap — so swapping the real one in
            does not shift the page under the reader. */}
        <div className="mt-8 -mx-5 flex justify-center sm:-mx-8 lg:-mx-16 xl:-mx-24">
          <div
            className="aspect-[16/9] w-full animate-skeleton-pulse bg-charcoal-800 max-lg:mx-5 max-lg:rounded-card max-lg:border max-lg:border-white/5"
            style={{ maxHeight: 'min(78vh, 900px)' }}
          />
        </div>
      </div>
    </section>
  )
}

export default function Visualizer2DLazy() {
  const [ref, entered] = useInView({ rootMargin: '500px' })
  // Deep links (#visualizer?room=…) must mount the real visualizer immediately,
  // not wait for IntersectionObserver — otherwise initialFromUrl() never runs
  // with the share params (or runs too late after a default boot).
  const [forceFromHash, setForceFromHash] = useState(hashWantsVisualizer)

  useEffect(() => {
    const sync = () => {
      if (hashWantsVisualizer()) setForceFromHash(true)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  if (!entered && !forceFromHash) return <Placeholder innerRef={ref} />

  return (
    <Suspense fallback={<Placeholder />}>
      <Visualizer2D />
    </Suspense>
  )
}
