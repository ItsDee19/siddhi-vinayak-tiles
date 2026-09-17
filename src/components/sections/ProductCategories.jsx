import Icon from '../Icons'
import { categories } from '../../data/products'

export default function ProductCategories() {
  return (
    <section id="products" className="section-pad bg-charcoal-800">
      <div className="container-px">
        <p className="eyebrow">At the showroom</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl sm:text-4xl">More ways to make a space yours.</h2>
        <div className="showroom-range">
          {categories.map(cat => (
            <a key={cat.id} href={cat.id === 'tiles' ? '#catalogue' : '#contact'} className="showroom-range-item">
              <Icon name={cat.icon} className="h-6 w-6 text-gold-light" />
              <div><h3>{cat.name}</h3><p>{cat.blurb}</p><span>{cat.id === 'tiles' ? 'Explore catalogues' : 'Enquire at the showroom'}</span></div>
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
