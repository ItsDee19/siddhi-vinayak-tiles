import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { testimonials, business } from '../../data/siteConfig'

export default function Testimonials() {
  return (
    <section className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="Kind Words"
          title="What Our Families Say"
          subtitle="We’re just getting started online. Be one of the first to share your experience and help other families choose with confidence."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-2xl border border-white/5 bg-charcoal-800 p-7 shadow-card">
                <div className="mb-4 flex gap-1 text-gold">
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <Icon key={s} name="star" className="h-4 w-4" filled />
                  ))}
                </div>
                <blockquote className="flex-1 text-sand/85">“{t.text}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 font-display text-lg text-gold">
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-medium text-cream">{t.name}</span>
                    <span className="block text-xs text-sand/60">{t.place}</span>
                  </span>
                  {t.placeholder && (
                    <span className="ml-auto rounded-full border border-sand/20 px-2.5 py-1 text-[9px] uppercase tracking-wider text-sand/50">
                      Sample
                    </span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}

          {/* Be the first to review CTA */}
          <Reveal delay={testimonials.length * 0.08}>
            <a
              href={business.googleReviewLink}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-7 text-center transition-colors hover:bg-gold/10"
            >
              <span className="mb-3 flex gap-1 text-gold/50 transition-colors group-hover:text-gold">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Icon key={s} name="star" className="h-5 w-5" />
                ))}
              </span>
              <h3 className="font-display text-xl text-cream">
                Be the first to review us
              </h3>
              <p className="mt-2 text-sm text-sand/75">
                Visited the showroom? Leave us a review on Google.
              </p>
              <span className="btn-outline mt-5 px-5 py-2.5 text-xs">
                Write a Review
                <Icon name="arrowRight" className="h-4 w-4" />
              </span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
