// A labelled row of multi-select filter pills.
//
// Only stocked options are supplied. Keep their positions stable as counts
// change, and keep selected zero-result options available to deselect.
export default function FilterGroup({ label, options, selected, onToggle }) {
  if (options.length === 0) return null

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-2 text-[11px] uppercase tracking-wider text-sand sm:min-w-[72px]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={active}
              disabled={!active && o.count === 0}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:min-h-9 ${
                active
                  ? 'border border-gold bg-gold/20 text-gold'
                  : 'border border-white/10 bg-charcoal-700 text-sand enabled:hover:bg-charcoal-600 enabled:hover:text-cream'
              }`}
            >
              {o.dot && (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/25"
                  style={{ backgroundColor: o.dot }}
                />
              )}
              {o.label}
              <span className={`min-w-[3ch] text-right tabular-nums ${active ? 'text-gold-light' : 'text-sand'}`}>{o.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
