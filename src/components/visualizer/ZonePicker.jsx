import { useMemo, useRef, useState } from 'react'
import Icon from '../Icons'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../utils/imageUpload'
import { resolveZoneSource } from '../../utils/threeTextures'
import { surfaceMatches } from '../../utils/surfaces'

const INITIAL_BATCH = 28

export default function ZonePicker({
  zone,                       // { id, label, surface }
  activeZoneId,
  zoneTextures,               // { [zoneId]: swatch }
  onSwatchPick,               // (zoneId, swatch) => void
  onActivateZone,             // (zoneId) => void
  onCustomUpload,             // (zoneId, file) => void
}) {
  const fileRef = useRef(null)
  const [subFilter, setSubFilter] = useState('all') // 'all' | '12x18' | '2x4' | 'floor'
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

    return list
  }, [surface, subFilter])

  const isActive = zone?.id === activeZoneId
  const current = zoneTextures[zone?.id]

  const visibleSwatches = useMemo(
    () => compatible.slice(0, limit),
    [compatible, limit],
  )
  const hasMore = limit < compatible.length

  return (
    <div
      className={`rounded-card border p-4 transition-all ${
        isActive ? 'border-gold bg-charcoal-800' : 'border-white/5 bg-charcoal-800/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <button onClick={() => onActivateZone(zone.id)} className="text-left">
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

      {isActive && (
        <>
          {/* Quick Collection Filters */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
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

          {/* Touch-Optimized Swatch Strip */}
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-2 scroll-smooth [scroll-snap-type:x_mandatory]">
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
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 transition-all [scroll-snap-align:start] ${
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
                className="h-14 px-3 shrink-0 flex items-center justify-center gap-1 rounded border border-gold/30 bg-gold/10 text-xs font-medium text-gold hover:bg-gold/20"
              >
                + More
              </button>
            )}
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-white/10 px-3 py-2 text-xs text-sand/70 hover:border-gold hover:text-gold"
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
