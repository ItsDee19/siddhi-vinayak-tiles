import { useMemo, useRef, useState } from 'react'
import Icon from '../Icons'
import { visualizerProducts as defaultProducts } from '../../data/visualizerCatalogue'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../utils/imageUpload'
import { resolveZoneSource } from '../../utils/tileSource'
import { surfaceMatches } from '../../utils/surfaces'
import { matchesQuery } from '../../utils/productSearch'

const INITIAL_BATCH = 28

export default function ZonePicker({
  zone,                       // { id, label, surface }
  activeZoneId,
  zoneTextures,               // { [zoneId]: swatch }
  onSwatchPick,               // (zoneId, swatch) => void
  onActivateZone,             // (zoneId) => void
  onCustomUpload,             // (zoneId, file) => void
  products = defaultProducts, // optional override (e.g. strong tiles only for 2D)
  compact = false,            // mobile bottom-sheet: denser chrome
}) {
  const fileRef = useRef(null)
  const [subFilter, setSubFilter] = useState('all') // 'all' | '12x18' | '2x4' | 'floor'
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(INITIAL_BATCH)
  const [uploadError, setUploadError] = useState('')

  const surface = zone?.surface
  const compatible = useMemo(() => {
    let list = surface
      ? products.filter((p) => surfaceMatches(p.surface, surface))
      : products

    list = list.filter((p) => p.imageUrl || p.textureUrl)

    if (subFilter === '12x18') {
      list = list.filter((p) => (p.size && p.size.includes('300x450')) || p.id.startsWith('sky12x18'))
    } else if (subFilter === '3x12') {
      list = list.filter((p) => p.size && p.size.includes('76x300'))
    } else if (subFilter === '6x12') {
      list = list.filter((p) => p.size && p.size.includes('150x300'))
    } else if (subFilter === '12x12-wall') {
      list = list.filter((p) => p.size && p.size.includes('300x300') && p.subCategory === 'Wall Tiles')
    } else if (subFilter === '16x16-parking') {
      list = list.filter((p) => p.size && p.size.includes('400x400') && surfaceMatches(p.surface, 'Floor'))
    } else if (subFilter === '12x12-parking') {
      list = list.filter((p) => p.size && p.size.includes('300x300') && surfaceMatches(p.surface, 'Floor'))
    } else if (subFilter === '2x4') {
      list = list.filter((p) => (p.size && p.size.includes('600x1200')) || p.id.startsWith('skype') || p.id.startsWith('sunflora'))
    } else if (subFilter === 'floor') {
      list = list.filter((p) => p.id.startsWith('gt-floor') || surfaceMatches(p.surface, 'Floor'))
    }

    // Name / code search runs last so it narrows whatever the size chips left.
    if (query.trim()) list = list.filter((p) => matchesQuery(p, query))

    return list
  }, [surface, subFilter, query, products])

  const isActive = zone?.id === activeZoneId
  const current = zoneTextures[zone?.id]

  const visibleSwatches = useMemo(
    () => compatible.slice(0, limit),
    [compatible, limit],
  )
  const hasMore = limit < compatible.length

  return (
    // The whole card selects the zone, not just the label. Clicks bubble up
    // from the panel below too, but every control in there only exists while
    // this zone is already active, so re-selecting it is a no-op — no need to
    // stop propagation and risk swallowing a swatch or search click.
    //
    // The heading stays a real <button> so the card is still reachable and
    // operable by keyboard and screen readers; the div is a mouse-convenience
    // layer on top of it, not a replacement for it.
    <div
      onClick={() => onActivateZone(zone.id)}
      className={`rounded-card border transition-all ${
        compact ? 'border-transparent bg-transparent p-0' : 'p-4'
      } ${
        !compact && isActive
          ? 'border-gold bg-charcoal-800'
          : !compact
            ? 'cursor-pointer border-white/5 bg-charcoal-800/60 hover:border-gold/40 hover:bg-charcoal-800'
            : ''
      }`}
    >
      {!compact && (
      <div className="flex items-center justify-between">
        <button
          onClick={() => onActivateZone(zone.id)}
          aria-pressed={isActive}
          className="text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/60 rounded"
        >
          <span className="text-[10px] uppercase tracking-wider text-sand/60">Zone</span>
          <h4 className="font-display text-base text-cream">{zone.label}</h4>
        </button>
        <div className="flex items-center gap-2">
          {current?.name && (
            <span className="text-[11px] font-medium text-gold max-w-[140px] truncate sm:max-w-none">
              {current.name}
            </span>
          )}
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold shrink-0">
            {surface}
          </span>
        </div>
      </div>
      )}

      {(isActive || compact) && (
        <>
          {/* Search by tile name or code. Sits above the size chips because it
              is the fastest route to a specific tile when the customer already
              knows what they are asking for — the chips are for browsing. */}
          <div className={`relative ${compact ? 'mt-0' : 'mt-3'}`}>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand/40"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(INITIAL_BATCH) }}
              placeholder="Search by tile name or code…"
              aria-label={`Search tiles for ${zone.label}`}
              className="w-full rounded-btn border border-white/10 bg-charcoal-900/60 py-2.5 pl-9 pr-8 text-xs text-cream placeholder:text-sand/40 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40 touch-manipulation"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setLimit(INITIAL_BATCH) }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-sand/50 hover:bg-white/10 hover:text-cream"
              >
                <Icon name="close" className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Collection Filters */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => { setSubFilter('all'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === 'all'
                  ? 'bg-gold text-ink font-semibold'
                  : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              All ({compatible.length})
            </button>
            <button
              onClick={() => { setSubFilter('12x18'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '12x18'
                  ? 'bg-gold text-ink font-semibold'
                  : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              12x18 Wall
            </button>
            <button
              onClick={() => { setSubFilter('3x12'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '3x12' ? 'bg-gold text-ink font-semibold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              3x12 Wall
            </button>
            <button
              onClick={() => { setSubFilter('6x12'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '6x12' ? 'bg-gold text-ink font-semibold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              6x12 Wall
            </button>
            <button
              onClick={() => { setSubFilter('12x12-wall'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '12x12-wall' ? 'bg-gold text-ink font-semibold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              12x12 Wall
            </button>
            <button
              onClick={() => { setSubFilter('16x16-parking'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '16x16-parking' ? 'bg-gold text-ink font-semibold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              16x16 Parking
            </button>
            <button
              onClick={() => { setSubFilter('12x12-parking'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '12x12-parking' ? 'bg-gold text-ink font-semibold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              12x12 Parking
            </button>
            <button
              onClick={() => { setSubFilter('2x4'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === '2x4'
                  ? 'bg-gold text-ink font-semibold'
                  : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              2x4 Slabs
            </button>
            <button
              onClick={() => { setSubFilter('floor'); setLimit(INITIAL_BATCH) }}
              className={`rounded-full px-2.5 py-0.5 transition-colors whitespace-nowrap ${
                subFilter === 'floor'
                  ? 'bg-gold text-ink font-semibold'
                  : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              Floor Collection
            </button>
          </div>

          {compatible.length === 0 && (
            <p className="mt-3 rounded-btn border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-sand/60">
              No tiles match “{query}”.{' '}
              <button onClick={() => { setQuery(''); setSubFilter('all') }} className="text-gold hover:underline">
                Clear search
              </button>
            </p>
          )}

          {/* Touch-Optimized Swatch Strip — larger targets on mobile/compact */}
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-2 scroll-smooth [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleSwatches.map((p) => {
              const sel = current?.id === p.id
              // Resolve through the same pipeline that supplies the actual
              // 3D wall texture (border-trimmed, seamless-healed, and
              // preferring the re-extracted clean_swatches_v2 source when
              // available) — a raw p.textureUrl here would show the
              // un-fixed original crop, out of sync with what gets applied.
              const resolved = resolveZoneSource(p)
              const thumb = resolved?.url || p.imageUrl
              return (
                <button
                  key={p.id}
                  onClick={() => onSwatchPick(zone.id, p)}
                  title={`${p.name}${p.size ? ` · ${p.size}` : ''}`}
                  className={`relative shrink-0 overflow-hidden rounded border-2 transition-all [scroll-snap-align:start] touch-manipulation ${
                    compact ? 'h-16 w-24' : 'h-14 w-20'
                  } ${
                    sel
                      ? 'border-gold shadow-glow ring-2 ring-gold/40'
                      : 'border-transparent hover:border-sand/40'
                  }`}
                  style={{ background: p.color || '#333' }}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {sel && (
                    <Icon name="star" className="absolute right-1 top-1 h-3.5 w-3.5 text-gold" filled />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[9px] font-medium text-cream truncate text-center">
                    {p.name.replace(/^Sky\s+/, '')}
                  </span>
                </button>
              )
            })}

            {hasMore && (
              <button
                onClick={() => setLimit((l) => l + 28)}
                className={`shrink-0 flex items-center justify-center gap-1 rounded border border-gold/30 bg-gold/10 text-xs font-medium text-gold hover:bg-gold/20 touch-manipulation ${
                  compact ? 'h-16 px-4' : 'h-14 px-3'
                }`}
              >
                + More
              </button>
            )}
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-btn border border-dashed border-white/10 px-3 py-2.5 text-xs text-sand/70 hover:border-gold hover:text-gold touch-manipulation"
          >
            <Icon name="send" className="h-3.5 w-3.5" /> Upload custom tile photo
          </button>
          {uploadError && (
            <p className="mt-1.5 text-center text-[11px] text-terracotta" role="alert">
              {uploadError}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // `accept` is advisory only — validate what actually came back.
              const { ok, error } = validateImageFile(file)
              setUploadError(ok ? '' : error)
              if (ok) onCustomUpload(zone.id, file)
              e.target.value = ''
            }}
          />
        </>
      )}
    </div>
  )
}
