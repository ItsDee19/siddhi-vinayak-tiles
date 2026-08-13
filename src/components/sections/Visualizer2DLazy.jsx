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
        <div className="mt-8 aspect-[16/9] w-full animate-pulse rounded-card border border-white/5 bg-charcoal-800" />
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
