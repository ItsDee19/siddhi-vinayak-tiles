import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import StatCounter from '../ui/StatCounter'
import { whyChooseUs, stats } from '../../data/siteConfig'

export default function WhyChooseUs() {
  return (
    <section className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="Why Families Choose Us"
          title="Built on Trust, Finished with Care"
          subtitle="We treat every customer like family — honest advice, quality material, and a fair price you can count on."
        />

        {/* feature cards */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyChooseUs.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="group h-full rounded-2xl border border-white/5 bg-charcoal-800 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/30 hover:shadow-glow">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold/12 ring-1 ring-gold/25">
                  <Icon name={f.icon} className="h-6 w-6 text-gold-light" />
                </div>
                <h3 className="font-display text-xl text-cream">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-sand/80">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* stats row */}
        <Reveal delay={0.1}>
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-charcoal-800 px-6 py-10 text-center"
              >
                <div className="font-display text-4xl font-bold text-gold sm:text-5xl">
                  <StatCounter value={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-2 text-sm uppercase tracking-wider text-sand/80">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
