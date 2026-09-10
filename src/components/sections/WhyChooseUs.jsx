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
        <div className="mt-8 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {whyChooseUs.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="group grid h-full grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 rounded-2xl border border-white/5 bg-charcoal-800 p-4 transition-colors duration-300 hover:border-gold/30 sm:block sm:p-7">
                <div className="row-span-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/12 ring-1 ring-gold/25 sm:mb-5 sm:h-12 sm:w-12">
                  <Icon name={f.icon} className="h-5 w-5 text-gold-light sm:h-6 sm:w-6" />
                </div>
                <h3 className="font-display text-xl text-cream">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-sand/80 sm:mt-3">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* stats row */}
        <Reveal delay={0.1}>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 sm:mt-12 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-charcoal-800 px-4 py-5 text-center sm:px-6 sm:py-10"
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
