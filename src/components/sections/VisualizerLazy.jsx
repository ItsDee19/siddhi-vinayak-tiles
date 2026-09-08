import { Suspense, lazy } from 'react'
import { useInView } from '../../hooks/useInView'
import SectionHeading from '../ui/SectionHeading'

const Visualizer = lazy(() => import('./Visualizer'))

const HEADING = {
  eyebrow: 'See It Before You Buy',
  title: 'Your tiles. A real sense of home.',
  subtitle:
    'Explore five spaces, choose a surface, and see how your favourite tiles work at room scale.',
}

// Lightweight placeholder shown before (and while) the real Visualizer loads.
// Matches its outer chrome/height so there's no layout jump on swap-in.
function Placeholder({ innerRef }) {
  return (
    <section ref={innerRef} id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading {...HEADING} />
        <div aria-hidden="true">
          <div className="mt-8 h-[59px] w-full rounded-card bg-charcoal-800 lg:h-12" />
          <div className="mt-4 h-8 lg:h-4" />
          <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-card border border-white/10 bg-charcoal-800">
              <div className="h-[min(310px,34svh)] min-h-[210px] sm:h-[440px] lg:h-[536px]" />
              <div className="h-16" />
            </div>
            <div className="h-[530px] rounded-card bg-charcoal-800 lg:h-[600px]" />
          </div>
          <div className="mt-4 h-[184px] rounded-card bg-charcoal-800 sm:h-[130px] lg:h-[70px]" />
          <div className="mt-3 h-[76px] sm:h-[40px]" />
        </div>
      </div>
    </section>
  )
}

// Defers the entire Visualizer — and the ~300KB gzip three.js / @react-three
// chunk and native room factories — until this section is near
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
