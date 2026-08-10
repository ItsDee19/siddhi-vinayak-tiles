import { Suspense, lazy } from 'react'
import { useInView } from '../../hooks/useInView'
import SectionHeading from '../ui/SectionHeading'

const Visualizer2D = lazy(() => import('./Visualizer2D'))

function Placeholder({ innerRef }) {
  return (
    <section
      ref={innerRef}
      id="visualizer-2d"
      className="section-pad relative border-t border-white/5 bg-charcoal-800"
    >
      <div className="container-px">
        <SectionHeading
          eyebrow="Lifestyle Preview"
          title="2D Room Visualizer"
          subtitle="Apply real catalogue tiles onto a fixed bathroom photo."
        />
        <div className="mt-8 aspect-[16/9] w-full animate-pulse rounded-card border border-white/5 bg-charcoal" />
      </div>
    </section>
  )
}

export default function Visualizer2DLazy() {
  const [ref, entered] = useInView({ rootMargin: '500px' })

  if (!entered) return <Placeholder innerRef={ref} />

  return (
    <Suspense fallback={<Placeholder />}>
      <Visualizer2D />
    </Suspense>
  )
}
