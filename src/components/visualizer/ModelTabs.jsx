import { models } from '../three/models'

export default function ModelTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Rooms">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          aria-pressed={active === m.id}
          className={`min-h-11 whitespace-nowrap rounded-btn px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
            active === m.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
          title={m.blurb}
        >
          <span className="mr-2 opacity-60" aria-hidden="true">{m.letter}</span>{m.name}
        </button>
      ))}
    </div>
  )
}
