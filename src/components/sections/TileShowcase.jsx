import SectionHeading from '../ui/SectionHeading'
import Coverflow from '../showcase/Coverflow'
import { showcaseSlides } from '../../data/tileShowcase'

// Replaced the interactive 2D room visualizer (now on the archive/2d-visualizer
// branch) with a passive 3D coverflow showcasing curated catalogue tiles.
//
// `id="visualizer"` is kept unchanged for anchor/deep-link stability — only
// the visible copy changed. Footprint matches the old component's actual
// rendered size exactly: the old `<canvas>` used `aspect-ratio: 16/9` +
// `max-height` + `width: auto`, which — because a canvas is a CSS *replaced*
// element — lets the browser shrink its WIDTH to stay within the height cap
// while holding the ratio. A plain `<div>` isn't a replaced element, so
// `width: auto` there just fills its container instead; the
// `width: min(100%, calc(<cap> * 16 / 9))` expressions below (Tailwind
// arbitrary properties, so they have to stay literal for the JIT scanner to
// pick them up) recreate the same effect by precomputing the width that
// height cap implies. Breakpoint (1024px) and both cap values are ported
// from the old component's `useIsMobile(1024)` split.
export default function TileShowcase() {
  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="Our Collection"
          title="Tile Showcase"
          subtitle="A closer look at tiles from our catalogue — drag, click an arrow, or use a side tile to browse."
        />

        <div className="mt-8 -mx-5 flex justify-center sm:-mx-8 lg:-mx-16 xl:-mx-24">
          <div
            className="max-lg:[max-height:min(56vh,460px)] max-lg:[width:min(100%,calc(min(56vh,460px)*16/9))] lg:[max-height:min(92vh,1200px)] lg:[width:min(100%,calc(min(92vh,1200px)*16/9))] block max-w-full max-lg:mx-5"
            style={{ aspectRatio: '16 / 9' }}
          >
            <Coverflow slides={showcaseSlides} />
          </div>
        </div>
      </div>
    </section>
  )
}
