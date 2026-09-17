import Icon from '../Icons'
import { business } from '../../data/siteConfig'

export default function Hero() {
  return (
    <section id="home" className="catalogue-hero">
      <div className="container-px catalogue-hero-layout">
        <div className="catalogue-hero-copy">
          <p className="eyebrow">Tiles & surfaces · Nuapada, Odisha</p>
          <h1>Find your tile.<br /><em>See every detail.</em></h1>
          <p className="catalogue-hero-intro">A closer look at the surfaces that make a home. Explore original tile catalogues, find a finish you love, and let our family help you bring it home.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#catalogue" className="btn-gold">Explore catalogues <Icon name="arrowDown" className="h-4 w-4" /></a>
            <a href="#contact" className="btn-outline">Visit the showroom</a>
          </div>
          <p className="catalogue-hero-location"><Icon name="mapPin" className="h-4 w-4" />{business.name} · Gayatri Mandir Chowk</p>
        </div>
        <figure className="catalogue-hero-image">
          <img src="/assets/catalogue/gt-floor-c001.webp" alt="A bright living room with grey floor tiles from the Global floor catalogue" width="1116" height="921" fetchpriority="high" />
          <figcaption>
            <span><span className="catalogue-caption-label">From the collection</span>Global floor tiles</span>
            <a href="/?catalogue=global-floor&page=3#catalogue" aria-label="View this room in the Global floor catalogue">Take a closer look <Icon name="arrowRight" className="h-4 w-4" /></a>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
