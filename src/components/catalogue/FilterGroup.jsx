// A labelled row of multi-select filter pills.
//
// Every option carries its own result count, and options that would return
// nothing are not rendered at all. That rule is the whole point of this
// component: the catalogue previously showed 20 filter options of which 11
// matched zero products (Marble, Granite and Quartz tabs, Exterior and Décor
// sub-types, and six of the nine colour pills), so a customer's most likely
// first click led to an empty grid.
export default function FilterGroup({ label, options, selected, onToggle }) {
  const live = options.filter((o) => o.count > 0)
  if (live.length === 0) return null

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-1.5 text-[11px] uppercase tracking-wider text-sand/50 sm:min-w-[72px]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {live.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                active
                  ? 'border border-gold bg-gold/20 text-gold shadow-[0_0_10px_rgba(196,154,60,0.2)]'
                  : 'border border-white/10 bg-charcoal-700 text-sand/70 hover:bg-charcoal-600 hover:text-cream'
              }`}
            >
              {o.dot && (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/25"
                  style={{ backgroundColor: o.dot }}
                />
              )}
              {o.label}
              <span className={active ? 'text-gold/70' : 'text-sand/40'}>{o.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
