import SwatchThumb from '../ui/SwatchThumb'
import Icon from '../Icons'

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
  // The visualizer uses procedural textures derived from color/type when no
  // textureUrl is present, so every product can be previewed in 3D.
  const has3D = ['Floor', 'Wall', 'Both', 'Countertop'].includes(product.surface)
  return (
    <button
      onClick={() => onOpen(product)}
      className="group relative overflow-hidden rounded-card border border-white/5 bg-charcoal-700 text-left shadow-soft transition-all hover:border-gold/30 hover:shadow-card"
    >
      {product.featured && (
        <span className="absolute right-2 top-2 z-10 rounded-btn bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
          Featured
        </span>
      )}
      <SwatchThumb swatch={asSwatch(product)} className="aspect-[4/3] w-full" eager />
      <div className="p-4">
        <h3 className="font-display text-base text-cream">{product.name}</h3>
        <p className="mt-1 text-xs text-sand/70">{product.size}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
            {product.finish}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
            {product.surface}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
            {product.priceRange}
          </span>
        </div>
        {has3D && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewIn3D(product) }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
          >
            <Icon name="compass" className="h-3.5 w-3.5" /> View in 3D
          </button>
        )}
      </div>
    </button>
  )
}
