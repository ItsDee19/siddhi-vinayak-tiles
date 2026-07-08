import { models } from '../three/models'

export default function ModelTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`whitespace-nowrap rounded-btn px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
            active === m.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
          title={m.blurb}
        >
          {m.name}
        </button>
      ))}
    </div>
  )
}
