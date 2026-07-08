import Icon from '../Icons'
import { business } from '../../data/siteConfig'

export default function EmptyState({ onClear }) {
  const waHref = `${business.whatsapp}?text=${encodeURIComponent(
    "Hi! I'm looking for a specific tile/material but couldn't find it on your site. Can you help?",
  )}`
  return (
    <div className="rounded-card border border-white/5 bg-charcoal-700 p-10 text-center">
      <Icon name="search" className="mx-auto h-10 w-10 text-sand/40" />
      <h3 className="mt-4 font-display text-xl text-cream">No products match these filters</h3>
      <p className="mt-2 text-sm text-sand/70">
        Try a different category, finish, or clear the filters. Or message us — we may have it in-store.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onClear} className="btn-outline">Clear filters</button>
        <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold">
          <Icon name="whatsapp" className="h-4 w-4" filled /> Ask on WhatsApp
        </a>
      </div>
    </div>
  )
}
