import { finishes } from '../../data/catalogue'

export default function FinishChips({ active, onChange }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {finishes.map((f) => (
        <button
          key={f}
          onClick={() => onChange(active === f ? null : f)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
            active === f
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-white/10 text-sand/70 hover:border-sand/30'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  )
}
