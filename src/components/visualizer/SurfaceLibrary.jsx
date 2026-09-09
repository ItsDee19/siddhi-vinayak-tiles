import { useId, useMemo, useRef, useState } from 'react'
import Icon from '../Icons'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../utils/imageUpload'
import { matchesQuery } from '../../utils/productSearch'
import { surfaceMatches } from '../../utils/surfaces'
import { resolveZoneSource } from '../../utils/threeTextures'

const INITIAL_BATCH = 24
const EMPTY_FILTERS = { query: '', size: 'all', limit: INITIAL_BATCH }
const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'
const formatSize = (size) => String(size || '').replace(/\s*[x×]\s*/gi, ' × ').replace(/\s*mm\b/i, ' mm')
const basinDetails = (product) => [product?.shapeLabel, product?.finish].filter(Boolean).join(' · ')

export default function SurfaceLibrary({
  zones = [],
  activeZoneId,
  zoneTextures = {},
  surfaceNote,
  onActivateZone,
  onSwatchPick,
  onCustomUpload,
  basinProducts = [],
  selectedBasin,
  onBasinPick,
}) {
  const searchId = useId()
  const sizeId = useId()
  const uploadHintId = useId()
  const fileRef = useRef(null)
  const searchRef = useRef(null)
  const uploadPendingRef = useRef(false)
  const gridRef = useRef(null)
  const [filters, setFilters] = useState({ tile: EMPTY_FILTERS, basin: EMPTY_FILTERS })
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const targets = useMemo(() => basinProducts.length
    ? [...zones, { id: 'basin', label: 'Tabletop basin', kind: 'basin' }]
    : zones, [zones, basinProducts.length])
  const zone = targets.find((item) => item.id === activeZoneId) || targets[0]
  const isBasin = zone?.kind === 'basin'
  const category = isBasin ? 'basin' : 'tile'
  const { query, size, limit } = filters[category]
  const selected = isBasin ? selectedBasin : zoneTextures[zone?.id]
  const selectedImage = isBasin ? selected?.imageUrl : resolveZoneSource(selected, 'lite')?.url

  const compatible = useMemo(() => isBasin
    ? basinProducts.filter((product) => product.imageUrl)
    : products.filter((product) => (
      product.textureUrl && zone && surfaceMatches(product.surface, zone.surface)
    )), [isBasin, basinProducts, zone?.surface])
  const sizes = useMemo(() => [...new Set(compatible.map((product) => product.size).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [compatible])
  const activeSize = sizes.includes(size) ? size : 'all'
  const filtered = useMemo(() => compatible.filter((product) => (
    (activeSize === 'all' || product.size === activeSize) && matchesQuery(product, query)
  )), [compatible, query, activeSize])
  const visible = filtered.slice(0, limit)

  const updateFilters = (patch) => {
    setFilters((current) => ({ ...current, [category]: { ...current[category], ...patch } }))
  }
  const resetResults = (patch = {}) => {
    updateFilters({ ...patch, limit: INITIAL_BATCH })
    if (gridRef.current) gridRef.current.scrollTop = 0
  }
  const clearFilters = () => {
    resetResults({ query: '', size: 'all' })
    searchRef.current?.focus({ preventScroll: true })
  }

  if (!zone) return null

  return (
    <div className="flex h-full min-h-0 flex-col bg-charcoal-800 p-4 text-cream">
      <div className="shrink-0">
        <p className="mb-2 text-sm font-semibold">{basinProducts.length ? 'Choose what to change' : 'Choose a surface'}</p>
        <div
          role="group"
          aria-label={basinProducts.length ? 'Surface or basin to change' : 'Surface to change'}
          className={`grid gap-1.5 ${targets.length === 1 ? 'grid-cols-1' : targets.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {targets.map((item) => {
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

        {surfaceNote && !isBasin && <p className="mt-2 text-[11px] text-sand-light">{surfaceNote}</p>}
        <div className="my-3 flex min-h-16 items-center gap-3" aria-live="polite" aria-atomic="true">
          {selectedImage ? (
            <img
              src={selectedImage}
              alt=""
              width="56"
              height="56"
              className={`h-14 w-14 shrink-0 rounded-btn object-contain ${isBasin ? 'bg-white' : 'bg-cream/10'}`}
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-btn bg-cream/10" aria-hidden="true">
              <Icon name="tiles" className="h-6 w-6 text-sand" />
            </div>
          )}
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs font-semibold leading-relaxed" title={selected?.name}>
              {selected?.name || (isBasin ? 'Display basin' : 'Room material')}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-sand-light">
              {isBasin
                ? [formatSize(selected?.size), basinDetails(selected)].filter(Boolean).join(' · ') || 'Choose a tabletop basin below'
                : selected?.isCustom
                ? 'Custom tile photo'
                : [formatSize(selected?.size), selected?.finish].filter(Boolean).join(' · ') || 'Choose a tile below'}
            </p>
          </div>
        </div>

        <div className={`flex gap-2 ${isBasin ? 'flex-col' : ''}`}>
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor={searchId}>{isBasin ? 'Search tabletop basins' : `Search tiles for ${zone.label}`}</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand" />
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => resetResults({ query: event.target.value })}
              placeholder={isBasin ? 'Search basins' : 'Search tiles'}
              className={`min-h-11 w-full min-w-0 rounded-btn border border-sand/30 bg-charcoal py-2 pl-9 pr-11 text-xs text-cream placeholder:text-sand [&::-webkit-search-cancel-button]:appearance-none ${focusStyle}`}
            />
            {query && (
              <button
                type="button"
                aria-label={`Clear ${category} search`}
                onClick={() => { resetResults({ query: '' }); searchRef.current?.focus({ preventScroll: true }) }}
                className={`absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-btn text-sand transition-colors hover:bg-white/10 hover:text-cream ${focusStyle}`}
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {(!isBasin || sizes.length > 1) && <><label className="sr-only" htmlFor={sizeId}>{isBasin ? 'Basin size' : `Tile size for ${zone.label}`}</label>
          <select
            id={sizeId}
            value={activeSize}
            onChange={(event) => resetResults({ size: event.target.value })}
            className={`min-h-11 shrink-0 rounded-btn border border-sand/30 bg-charcoal px-2 text-xs text-cream ${isBasin ? 'w-full' : 'w-[116px]'} ${focusStyle}`}
          >
            <option value="all">All sizes</option>
            {sizes.map((item) => <option key={item} value={item}>{formatSize(item)}</option>)}
          </select></>}
        </div>
        <p className="mb-2 mt-2.5 text-[11px] text-sand-light" role="status">
          {filtered.length} {isBasin
            ? `tabletop ${filtered.length === 1 ? 'basin' : 'basins'}`
            : `${filtered.length === 1 ? 'tile' : 'tiles'} for ${zone.label.toLowerCase()}`}
        </p>
      </div>

      <div
        key={category}
        ref={gridRef}
        className="min-h-[120px] flex-1 overflow-y-auto overscroll-contain pb-1 pr-1 [scrollbar-gutter:stable]"
        aria-label={isBasin ? 'Tabletop basin library' : `Tile library for ${zone.label}`}
      >
        {filtered.length ? (
          <>
            <div className={`grid gap-2 ${isBasin ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {visible.map((product) => {
                const active = selected?.id === product.id
                const image = isBasin ? product.imageUrl : resolveZoneSource(product, 'lite')?.url
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => isBasin ? onBasinPick?.(product) : onSwatchPick?.(zone.id, product)}
                    aria-pressed={active}
                    aria-label={`${isBasin ? 'Choose' : 'Apply'} ${product.name}${product.size ? `, ${formatSize(product.size)}` : ''}${isBasin ? '' : ` to ${zone.label}`}`}
                    title={[product.name, formatSize(product.size), isBasin ? basinDetails(product) : product.finish].filter(Boolean).join(' · ')}
                    className={`group min-h-11 min-w-0 overflow-hidden rounded-btn border-2 text-left transition-colors ${focusStyle} ${
                      active ? 'border-gold bg-gold/15' : 'border-transparent bg-charcoal hover:border-sand/70'
                    }`}
                  >
                    <span className={`relative block ${isBasin ? 'aspect-[4/3] bg-white' : 'aspect-square bg-cream/10'}`}>
                      <img
                        src={image}
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
                    {isBasin ? (
                      <span className="block space-y-1 px-2 py-2.5 text-[10px] leading-relaxed">
                        <span className="block text-xs font-semibold text-cream">{product.name}</span>
                        <span className="block text-sand-light">{formatSize(product.size)}</span>
                        <span className="block text-sand-light">{basinDetails(product)}</span>
                      </span>
                    ) : (
                      <span className="block truncate px-1.5 py-2 text-[10px] leading-normal text-cream">
                        {product.name}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => updateFilters({ limit: limit + INITIAL_BATCH })}
                className={`mt-3 min-h-11 w-full rounded-btn border border-sand/30 px-3 py-2 text-xs font-semibold text-cream hover:border-gold hover:bg-charcoal ${focusStyle}`}
              >
                Show {Math.min(INITIAL_BATCH, filtered.length - visible.length)} more {isBasin ? 'basins' : 'tiles'}
              </button>
            )}
          </>
        ) : (
          <div className="px-3 py-5 text-center text-xs leading-relaxed text-sand-light">
            <p>{compatible.length
              ? `No ${isBasin ? 'basins' : 'tiles'} match your search and size.`
              : isBasin ? 'No tabletop basin photos are available yet.' : 'No catalogue tile photos are available for this surface yet.'}</p>
            {(query || activeSize !== 'all') && (
              <button type="button" onClick={clearFilters} className={`mt-2 min-h-11 px-3 text-gold-light underline underline-offset-4 ${focusStyle}`}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {isBasin ? (
        <p className="mt-3 shrink-0 border-t border-sand/20 pt-3 text-[11px] leading-relaxed text-sand-light">
          3D shape and colour are approximate; compare the catalogue photo.
        </p>
      ) : (
        <div className="mt-3 shrink-0 border-t border-sand/20 pt-3">
          <button
            type="button"
            onClick={() => { setUploadError(''); fileRef.current?.click() }}
            disabled={uploading}
            aria-busy={uploading}
            aria-describedby={uploadHintId}
            className={`min-h-11 w-full rounded-btn border border-sand/30 px-3 py-2 text-xs font-semibold text-cream transition-colors enabled:hover:border-gold enabled:hover:bg-charcoal disabled:cursor-wait disabled:opacity-60 ${focusStyle}`}
          >
            {uploading ? 'Adding tile photo…' : 'Use your own tile photo'}
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
              if (!file || uploadPendingRef.current) return
              const result = validateImageFile(file)
              setUploadError(result.ok ? '' : result.error)
              if (!result.ok) return
              uploadPendingRef.current = true
              setUploading(true)
              try {
                await onCustomUpload?.(zone.id, file)
              } catch {
                setUploadError('This image could not be added. Try another JPG, PNG or WebP.')
              } finally {
                uploadPendingRef.current = false
                setUploading(false)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
