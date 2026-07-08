import { categories } from '../../data/products'

export default function CategoryTabs({ active, onChange }) {
  const items = [{ id: 'all', name: 'All' }, ...categories]
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`rounded-btn px-5 py-2.5 text-sm font-semibold transition-all duration-150 ease-pr ${
            active === c.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
