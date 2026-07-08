import { subCategories } from '../../data/catalogue'

export default function SubCategoryStrip({ category, active, onChange }) {
  if (category === 'all') return null
  const subs = subCategories[category] || []
  if (subs.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          active === null ? 'bg-gold/20 text-gold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
        }`}
      >
        All {category.charAt(0).toUpperCase() + category.slice(1)}
      </button>
      {subs.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            active === s ? 'bg-gold/20 text-gold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
