import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import TiltCard from '../ui/TiltCard'
import SectionHeading from '../ui/SectionHeading'
import { categories } from '../../data/products'
import { publishCatalogueCategory } from '../../utils/catalogueSelection'
import { scrollToSection } from '../../utils/sectionNavigation'

// Clicking a category scrolls to the catalogue and pre-selects that filter.
function goToCatalogue(id) {
  if (publishCatalogueCategory(id)) scrollToSection('catalogue', { focus: true })
  else scrollToSection('contact', { focus: true })
}

export default function ProductCategories() {
  return (
    <section id="products" className="section-pad relative bg-charcoal-800 grain-overlay">
      <div className="container-px">
        <SectionHeading
          eyebrow="What We Offer"
          title="Five Surfaces, One Roof"
          subtitle="Browse tiles and sanitaryware online, or ask our showroom team about marble, granite and quartz."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 0.07}>
                <TiltCard
                  as="button"
                  type="button"
                  onClick={() => goToCatalogue(cat.id)}
                className="group h-full w-full cursor-pointer rounded-2xl text-left"
              >
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-charcoal-700 to-charcoal-800 p-7 shadow-card transition-colors duration-300 group-hover:border-gold/30">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gold/12 ring-1 ring-gold/25 transition-all duration-300 group-hover:bg-gold/20 group-hover:shadow-glow">
                    <Icon name={cat.icon} className="h-7 w-7 text-gold-light" />
                  </div>

                  <h3 className="font-display text-2xl font-semibold text-cream">
                    {cat.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-sand/85">
                    {cat.blurb}
                  </p>

                  <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
                    {['tiles', 'sanitaryware'].includes(cat.id) ? 'View in Catalogue' : 'Enquire at showroom'}
                    <Icon name="arrowRight" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>

                  {/* number watermark */}
                  <span className="pointer-events-none absolute -bottom-3 right-4 font-display text-7xl font-bold text-white/[0.03]">
                    0{i + 1}
                  </span>
                </div>
              </TiltCard>
            </Reveal>
          ))}

          {/* CTA tile to fill the 6th grid slot */}
          <Reveal delay={categories.length * 0.07}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/15 to-terracotta/10 p-7 shadow-card">
              <div>
                <h3 className="font-display text-2xl font-semibold text-cream">
                  Not sure where to start?
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-sand">
                  Visit the showroom or call us — we’ll help you find the right
                  surface for your home and budget.
                </p>
              </div>
              <a href="#visualizer" className="btn-gold mt-6 self-start">
                Try the Visualizer
                <Icon name="arrowRight" className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
