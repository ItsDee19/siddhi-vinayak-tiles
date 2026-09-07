import { useId, useMemo, useRef, useState } from 'react'
import Icon from '../Icons'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../utils/imageUpload'
import { matchesQuery } from '../../utils/productSearch'
import { surfaceMatches } from '../../utils/surfaces'
import { resolveZoneSource } from '../../utils/threeTextures'

const INITIAL_BATCH = 24
const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'
const formatSize = (size) => String(size || '').replace(/\s*[x×]\s*/gi, ' × ').replace(/\s*mm\b/i, ' mm')

export default function SurfaceLibrary({
  zones = [],
  activeZoneId,
  zoneTextures = {},
  surfaceNote,
  onActivateZone,
  onSwatchPick,
  onCustomUpload,
}) {
  const searchId = useId()
  const sizeId = useId()
  const uploadHintId = useId()
  const fileRef = useRef(null)
  const gridRef = useRef(null)
  const [query, setQuery] = useState('')
  const [size, setSize] = useState('all')
  const [limit, setLimit] = useState(INITIAL_BATCH)
  const [uploadError, setUploadError] = useState('')
  const zone = zones.find((item) => item.id === activeZoneId) || zones[0]
  const selected = zoneTextures[zone?.id]
  const selectedSource = resolveZoneSource(selected, 'lite')

  const compatible = useMemo(() => products.filter((product) => (
    product.textureUrl && zone && surfaceMatches(product.surface, zone.surface)
  )), [zone?.surface])
  const sizes = useMemo(() => [...new Set(compatible.map((product) => product.size).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [compatible])
  const filtered = useMemo(() => compatible.filter((product) => (
    (size === 'all' || product.size === size) && matchesQuery(product, query)
  )), [compatible, query, size])
  const visible = filtered.slice(0, limit)

  const resetResults = () => {
    setLimit(INITIAL_BATCH)
    if (gridRef.current) gridRef.current.scrollTop = 0
  }
  const clearFilters = () => {
    setQuery('')
    setSize('all')
    resetResults()
  }

  if (!zone) return null

  return (
    <div className="flex h-full min-h-0 flex-col bg-charcoal-800 p-4 text-cream">
      <div className="shrink-0">
        <p className="mb-2 text-sm font-semibold">Choose a surface</p>
        <div
          role="group"
          aria-label="Surface to change"
          className={`grid gap-1.5 ${zones.length === 1 ? 'grid-cols-1' : zones.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {zones.map((item) => {
            const active = item.id === zone.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onActivateZone?.(item.id)}
                aria-pressed={active}
                className={`min-h-11 rounded-btn border px-2 py-2 text-xs font-semibold leading-snug transition-colors ${focusStyle} ${
                  active ? 'border-gold bg-gold text-ink' : 'border-sand/25 bg-charcoal text-cream hover:border-gold/70'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {surfaceNote && <p className="mt-2 text-[11px] text-sand-light">{surfaceNote}</p>}
        <div className="my-3 flex min-h-16 items-center gap-3" aria-live="polite" aria-atomic="true">
          {selectedSource?.url ? (
            <img
              src={selectedSource.url}
              alt=""
              width="56"
              height="56"
              className="h-14 w-14 shrink-0 rounded-btn bg-cream/10 object-contain"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-btn bg-cream/10" aria-hidden="true">
              <Icon name="tiles" className="h-6 w-6 text-sand" />
            </div>
          )}
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs font-semibold leading-relaxed" title={selected?.name}>
              {selected?.name || 'Room material'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-sand-light">
              {selected?.isCustom
                ? 'Custom tile photo'
                : [formatSize(selected?.size), selected?.finish].filter(Boolean).join(' · ') || 'Choose a tile below'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor={searchId}>Search tiles for {zone.label}</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); resetResults() }}
              placeholder="Search tiles"
              className={`min-h-11 w-full min-w-0 rounded-btn border border-sand/30 bg-charcoal py-2 pl-9 pr-2 text-xs text-cream placeholder:text-sand ${focusStyle}`}
            />
          </div>
          <label className="sr-only" htmlFor={sizeId}>Tile size for {zone.label}</label>
          <select
            id={sizeId}
            value={size}
            onChange={(event) => { setSize(event.target.value); resetResults() }}
            className={`min-h-11 w-[116px] shrink-0 rounded-btn border border-sand/30 bg-charcoal px-2 text-xs text-cream ${focusStyle}`}
          >
            <option value="all">All sizes</option>
            {sizes.map((item) => <option key={item} value={item}>{formatSize(item)}</option>)}
          </select>
        </div>
        <p className="mb-2 mt-2.5 text-[11px] text-sand-light" role="status">
          {filtered.length} {filtered.length === 1 ? 'tile' : 'tiles'} for {zone.label.toLowerCase()}
        </p>
      </div>

      <div
        ref={gridRef}
        className="min-h-[120px] flex-1 overflow-y-auto overscroll-contain pb-1 pr-1 [scrollbar-color:#9A7530_#2C1A0E] [scrollbar-width:thin]"
        aria-label={`Tile library for ${zone.label}`}
      >
        {filtered.length ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {visible.map((product) => {
                const active = selected?.id === product.id
                const source = resolveZoneSource(product, 'lite')
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onSwatchPick?.(zone.id, product)}
                    aria-pressed={active}
                    aria-label={`Apply ${product.name}${product.size ? `, ${formatSize(product.size)}` : ''} to ${zone.label}`}
                    title={[product.name, formatSize(product.size), product.finish].filter(Boolean).join(' · ')}
                    className={`group min-h-11 min-w-0 overflow-hidden rounded-btn border-2 text-left transition-colors ${focusStyle} ${
                      active ? 'border-gold bg-gold/15' : 'border-transparent bg-charcoal hover:border-sand/70'
                    }`}
                  >
                    <span className="relative block aspect-square bg-cream/10">
                      <img
                        src={source?.url}
                        alt=""
                        width="100"
                        height="100"
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                      {active && (
                        <span className="absolute inset-x-0 bottom-0 bg-gold px-1 py-0.5 text-center text-[10px] font-semibold text-ink">
                          Selected
                        </span>
                      )}
                    </span>
                    <span className="block truncate px-1.5 py-2 text-[10px] leading-normal text-cream">
                      {product.name}
                    </span>
                  </button>
                )
              })}
            </div>
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setLimit((current) => current + INITIAL_BATCH)}
                className={`mt-3 min-h-11 w-full rounded-btn border border-sand/30 px-3 py-2 text-xs font-semibold text-cream hover:border-gold hover:bg-charcoal ${focusStyle}`}
              >
                Show {Math.min(INITIAL_BATCH, filtered.length - visible.length)} more tiles
              </button>
            )}
          </>
        ) : (
          <div className="px-3 py-5 text-center text-xs leading-relaxed text-sand-light">
            <p>{compatible.length ? 'No tiles match your search and size.' : 'No catalogue tile photos are available for this surface yet.'}</p>
            {(query || size !== 'all') && (
              <button type="button" onClick={clearFilters} className={`mt-2 min-h-11 px-3 text-gold-light underline underline-offset-4 ${focusStyle}`}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-sand/20 pt-3">
        <button
          type="button"
          onClick={() => { setUploadError(''); fileRef.current?.click() }}
          aria-describedby={uploadHintId}
          className={`min-h-11 w-full rounded-btn border border-sand/30 px-3 py-2 text-xs font-semibold text-cream hover:border-gold hover:bg-charcoal ${focusStyle}`}
        >
          Use your own tile photo
        </button>
        <p id={uploadHintId} className="mt-2 text-[10px] leading-relaxed text-sand-light">
          JPG, PNG or WebP · Up to 8 MB.<br />
          Custom photos preview at an approximate 600 mm scale.
        </p>
        {uploadError && <p role="alert" className="mt-2 text-xs leading-relaxed text-[#ffc2a8]">{uploadError}</p>}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          aria-label={`Upload a tile photo for ${zone.label}`}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const result = validateImageFile(file)
            setUploadError(result.ok ? '' : result.error)
            if (!result.ok) return
            try {
              await onCustomUpload?.(zone.id, file)
            } catch {
              setUploadError('This image could not be added. Try another JPG, PNG or WebP.')
            }
          }}
        />
      </div>
    </div>
  )
}
