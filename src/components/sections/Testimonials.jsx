import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { testimonials, business } from '../../data/siteConfig'

export default function Testimonials() {
  const publishedReviews = testimonials.filter(review => !review.placeholder)
  return (
    <section id="reviews" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow={publishedReviews.length ? 'Kind Words' : 'Your experience'}
          title={publishedReviews.length ? 'What Our Families Say' : 'Visited our showroom?'}
          subtitle={publishedReviews.length ? 'Customer experiences from our showroom in Nuapada.' : 'Share your experience and help other families choose with confidence.'}
        />

        <div className={publishedReviews.length ? `mx-auto mt-14 grid gap-6 md:grid-cols-2 ${publishedReviews.length > 1 ? 'lg:grid-cols-3' : 'max-w-5xl'}` : 'mx-auto mt-10 max-w-xl'}>
          {publishedReviews.map((t, i) => (
            <Reveal key={i} delay={i * 0.045}>
              <figure className="flex h-full flex-col rounded-2xl border border-white/5 bg-charcoal-800 p-7 shadow-card">
                {Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5 && <div className="mb-4 flex gap-1 text-gold" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <Icon key={s} name="star" className="h-4 w-4" filled />
                  ))}
                </div>}
                <blockquote className="flex-1 text-sand/85">“{t.text}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 font-display text-lg text-gold">
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-medium text-cream">{t.name}</span>
                    {t.place && <span className="block text-xs text-sand/60">{t.place}</span>}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}

          {/* Invite customers to share their own experience. */}
          <Reveal delay={publishedReviews.length * 0.08}>
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
                Share your experience
              </h3>
              <p className="mt-2 text-sm text-sand/75">
                Visited the showroom? Find our Google listing to share your experience.
              </p>
              <span className="btn-outline mt-5 px-5 py-2.5 text-xs">
                Find us on Google
                <Icon name="arrowRight" className="h-4 w-4" />
              </span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
