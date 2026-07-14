import { motion } from 'framer-motion'
import Icon from '../Icons'
import SwatchThumb from '../ui/SwatchThumb'
import { business } from '../../data/siteConfig'

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

export default function ProductLightbox({ product, onClose, onViewIn3D }) {
  if (!product) return null
  const waText = encodeURIComponent(
    `Hi! I'd like to know more about "${product.name}" (${product.size}, ${product.finish}). Is it available?`
  )
  const waHref = `${business.whatsapp}?text=${waText}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/90 p-4 backdrop-blur-sm"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-cream hover:bg-white/20"
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-card border border-white/10 bg-charcoal-800 shadow-card"
      >
        <SwatchThumb swatch={asSwatch(product)} className="aspect-video w-full" eager size={640} />
        <div className="p-6">
          <span className="text-xs uppercase tracking-wider text-gold">
            {product.category} · {product.subCategory}
          </span>
          <h3 className="mt-1 font-display text-2xl text-cream">{product.name}</h3>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand/60">Size</dt>
              <dd className="mt-1 text-cream">{product.size}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand/60">Finish</dt>
              <dd className="mt-1 text-cream">{product.finish}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand/60">Surface</dt>
              <dd className="mt-1 text-cream">{product.surface}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand/60">Price</dt>
              <dd className="mt-1 text-cream">{product.priceRange}</dd>
            </div>
          </dl>
          {product.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-sand/70">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold">
              <Icon name="whatsapp" className="h-4 w-4" filled /> Ask for this product
            </a>
            <button onClick={() => onViewIn3D(product)} className="btn-outline">
              <Icon name="compass" className="h-4 w-4" /> View in 3D
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
