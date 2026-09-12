import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import { business } from '../../data/siteConfig'

const aboutPoints = [
  {
    title: 'Curated Selection',
    text: 'Hand-picked tiles, marble, granite, quartz & sanitaryware.',
  },
  {
    title: 'Family Guidance',
    text: 'Personal advice from a family that knows the trade.',
  },
  {
    title: 'Fair Pricing',
    text: 'Transparent prices you can trust — no pressure, ever.',
  },
]

export default function About() {
  return (
    <section id="about" className="section-pad relative overflow-hidden bg-charcoal-800">
      {/* warm accent glows */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />

      <div className="container-px">
        {/* heading + intro */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow justify-center">
              <span className="h-px w-8 bg-gold" />
              Our Story
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="heading-display mt-4 text-3xl text-cream sm:mt-5 sm:text-5xl">
              A Family Showroom in the Heart of Nuapada
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-4 text-base leading-relaxed text-sand sm:mt-6 sm:text-lg">
              {business.name} began with a simple belief — that choosing the
              surfaces for your home should feel personal, not transactional.
              From our showroom at Gayatri Mandir Chowk, we help families across
              Nuapada find tiles and stone they’ll love for decades.
            </p>
          </Reveal>
        </div>

        {/* value cards */}
        <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-5">
          {aboutPoints.map((p, i) => (
            <Reveal key={p.title} delay={0.1 + i * 0.08}>
              <div className="grid h-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 rounded-2xl border border-white/5 bg-charcoal/60 p-4 shadow-card sm:block sm:p-6 sm:text-center">
                <span className="row-span-2 mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold-light">
                  <Icon name="star" className="h-5 w-5" filled />
                </span>
                <h3 className="font-display text-lg text-cream sm:mt-4">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-sand sm:mt-2">
                  {p.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* featured quote */}
        <Reveal delay={0.2}>
          <blockquote className="mx-auto mt-6 max-w-2xl rounded-2xl border-l-2 border-gold bg-gradient-to-r from-gold/10 to-transparent p-4 text-center sm:mt-12 sm:p-6">
            <p className="font-display text-2xl italic text-gold-light sm:text-3xl">
              “{business.tagline}”
            </p>
            <footer className="mt-2 text-sm text-sand">
              — The promise we keep with every visitor
            </footer>
          </blockquote>
        </Reveal>
      </div>
    </section>
  )
}
