import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { testimonials, business } from '../../data/siteConfig'

export default function Testimonials() {
  const reviews = testimonials.filter((review) => !review.placeholder && review.name && review.text)
  const feedbackLink = business.googleReviewLink || `${business.whatsapp}?text=${encodeURIComponent(
    `Hello ${business.name}, I'd like to share feedback about my showroom visit.`,
  )}`

  return (
    <section className="relative bg-charcoal py-12 sm:py-16">
      <div className="container-px">
        {reviews.length > 0 && (
          <>
            <SectionHeading
              eyebrow="Kind Words"
              title="From Our Customers"
              subtitle="Experiences shared by visitors to our showroom."
            />
            <div className="mb-10 mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, index) => (
                <Reveal key={`${review.name}-${index}`} delay={index * 0.06}>
                  <figure className="flex h-full flex-col rounded-2xl border border-white/5 bg-charcoal-800 p-7">
                    {Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 && (
                      <div className="mb-4 flex gap-1 text-gold" role="img" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: review.rating }, (_, star) => (
                          <Icon key={star} name="star" className="h-4 w-4" filled />
                        ))}
                      </div>
                    )}
                    <blockquote className="flex-1 text-sand/85">“{review.text}”</blockquote>
                    <figcaption className="mt-6">
                      <span className="block font-medium text-cream">{review.name}</span>
                      <span className="block text-xs text-sand/70">{review.place}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </>
        )}

        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 border-y border-white/10 py-8 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl text-cream">Visited the showroom?</h2>
              <p className="mt-2 text-sm leading-relaxed text-sand/80">
                {business.googleReviewLink
                  ? 'Share your experience on Google to help others plan their visit.'
                  : 'Share your experience with our team. We’d love to hear what helped and what we can improve.'}
              </p>
            </div>
            <a href={feedbackLink} target="_blank" rel="noopener noreferrer" className="btn-outline shrink-0">
              <Icon name={business.googleReviewLink ? 'star' : 'whatsapp'} className="h-4 w-4" />
              {business.googleReviewLink ? 'Write a Google review' : 'Share feedback on WhatsApp'}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
