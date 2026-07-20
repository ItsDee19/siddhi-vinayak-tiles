import { Suspense, lazy } from 'react'
import { useInView } from '../../hooks/useInView'
import SectionHeading from '../ui/SectionHeading'

const Visualizer = lazy(() => import('./Visualizer'))

const HEADING = {
  eyebrow: 'See It Before You Buy',
  title: 'Interactive Tile Visualizer',
  subtitle:
    'Pick a model, then assign tiles to each surface zone. Drag to orbit, scroll to zoom — preview the look before you visit.',
}

// Lightweight placeholder shown before (and while) the real Visualizer loads.
// Matches its outer chrome/height so there's no layout jump on swap-in.
function Placeholder({ innerRef }) {
  return (
    <section ref={innerRef} id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading {...HEADING} />
        <div className="mt-8 aspect-[4/3] w-full animate-pulse rounded-card border border-white/5 bg-charcoal-800 lg:aspect-auto lg:min-h-[540px]" />
      </div>
    </section>
  )
}

// Defers the entire Visualizer — and the ~300KB gzip three.js / @react-three
// chunk + all 5 GLB model preloads it pulls in — until this section is near
// the viewport. Keeps the heavy 3D engine off the critical path for anyone
// who never scrolls this far, and off mobile connections until it's needed.
export default function VisualizerLazy() {
  const [ref, entered] = useInView({ rootMargin: '600px' })

  if (!entered) return <Placeholder innerRef={ref} />

  return (
    <Suspense fallback={<Placeholder />}>
      <Visualizer />
    </Suspense>
  )
}
