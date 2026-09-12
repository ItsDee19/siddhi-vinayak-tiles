import { categories } from '../../data/products'

// `counts` maps category id -> number of products in stock. Categories with
// none are not rendered: marble, granite and quartz are showroom enquiries,
// with no product records in the online catalogue.
export default function CategoryTabs({ active, onChange, counts = {} }) {
  const stocked = categories.filter((c) => (counts[c.id] || 0) > 0)
  // With a single stocked category the tab row is just a label — the "All" tab
  // and that category select the same set.
  if (stocked.length < 2) return null

  const items = [{ id: 'all', name: 'All' }, ...stocked]
  return (
    <div role="group" aria-label="Product category" className="flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          aria-pressed={active === c.id}
          className={`min-h-11 min-w-11 rounded-btn px-2.5 py-2.5 text-[13px] font-semibold transition-colors duration-150 ease-pr focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:px-5 sm:text-sm ${
            active === c.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
        >
          {c.name}
          {c.id !== 'all' && (
            <span className={`ml-1.5 text-xs ${active === c.id ? 'text-ink' : 'text-sand'}`}>
              {counts[c.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
