import SwatchThumb from '../ui/SwatchThumb'
import Icon from '../Icons'
import { canPreviewProduct } from '../../utils/visualizerPreview'

// Convert catalogue product → shape SwatchThumb understands
function asSwatch(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.category.toLowerCase(),
    color: p.color,
    accent: p.accent || p.color,
    image: p.imageUrl,
  }
}

export default function ProductCard({ product, onOpen, onViewIn3D }) {
  const has3D = canPreviewProduct(product)
  return (
    <article
      className="group relative h-full overflow-hidden rounded-card border border-white/5 bg-charcoal-700 text-left shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-gold/30 hover:shadow-card focus-within:border-gold/60"
    >
      {product.featured && (
        <span className="absolute right-2 top-2 z-10 rounded-btn bg-gold px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink sm:px-2 sm:text-[10px]">
          Featured
        </span>
      )}
      <SwatchThumb swatch={asSwatch(product)} className="aspect-[4/3] w-full" />
      <div className="p-3 sm:p-4">
        <h3 className="font-sans text-sm font-medium leading-snug text-cream sm:font-display sm:text-base sm:font-normal">
          <button
            type="button"
            onClick={() => onOpen(product)}
            aria-label={`View details for ${product.name}`}
            aria-haspopup="dialog"
            className="line-clamp-2 break-words text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-gold sm:line-clamp-none"
          >
            {product.name}
          </button>
        </h3>
        <p className="mt-1 text-[11px] text-sand sm:text-xs">{product.size}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
            {product.finish}
          </span>
          <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70 sm:inline">
            {product.surface}
          </span>
          <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70 sm:inline">
            {product.priceRange}
          </span>
        </div>
        {has3D && (
          <button
            type="button"
            onClick={() => onViewIn3D(product)}
            className="relative z-10 mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-light hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:mt-2"
          >
            <Icon name="compass" className="h-3.5 w-3.5" /> View in 3D
          </button>
        )}
      </div>
    </article>
  )
}
