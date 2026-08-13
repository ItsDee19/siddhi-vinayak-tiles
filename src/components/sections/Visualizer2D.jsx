import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import ZonePicker from '../visualizer/ZonePicker'
import Icon from '../Icons'
import { rooms2d, preloadRoomAssets } from '../../data/rooms2d'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { surfaceMatches } from '../../utils/surfaces'
import { isStrong2dTile } from '../../data/tileQuality2d'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'
import { validateImageFile } from '../../utils/imageUpload'
import RoomCanvas from '../visualizer2d/RoomCanvas'
import { composeRoomExport } from '../visualizer2d/composeRoom'

/** Strong seamless tiles only — weak/tiny pipeline WebPs are excluded from 2D. */
const strongProducts = products.filter(isStrong2dTile)

const FALLBACK_TILE_SCALE = 0.55

function roomTileScale(room) {
  const s = room?.defaultTileScale
  return typeof s === 'number' && s > 0 ? s : FALLBACK_TILE_SCALE
}

/** Score product for a calm, realistic first-open starter (not flashy hero tiles). */
function starterTileScore(product, zoneSurface) {
  let score = 0
  const name = String(product.name || '').toLowerCase()
  const finish = String(product.finish || '').toLowerCase()
  const size = String(product.size || '')

  if (/600\s*[x×]\s*600/i.test(size)) score += 5
  else if (/300\s*[x×]\s*600/i.test(size)) score += 4
  else if (/600\s*[x×]\s*1200/i.test(size)) score += 1
  else if (/300\s*[x×]\s*300/i.test(size)) score += 2
  else score += 2

  if (/(grey|gray|beige|ivory|cream|white|ash|fog|stone|cement|concrete|sand|taupe|pearl|silver|mist)/i.test(name)) {
    score += 6
  }
  if (/(gold|golden|yellow|neon|copper|bronze|metallic|glitter|sparkle|black.?gold)/i.test(name)) {
    score -= 8
  }

  if (/(matte|matt|soft|honed)/i.test(finish)) score += 2
  if (/(gloss|polished|high.?gloss)/i.test(finish)) score -= 1

  const surf = String(product.surface || '')
  if (zoneSurface && surf === zoneSurface) score += 3
  else if (/Both/i.test(surf)) score += 1

  return score
}

function defaultZoneTextures(zones) {
  const out = {}
  const used = new Set()
  zones.forEach((z) => {
    const matching = strongProducts.filter((p) => surfaceMatches(p.surface, z.surface))
    const ranked = [...matching].sort(
      (a, b) => starterTileScore(b, z.surface) - starterTileScore(a, z.surface),
    )
    const candidate = ranked.find((p) => !used.has(p.id)) || ranked[0]
    if (candidate) {
      out[z.id] = candidate
      used.add(candidate.id)
    }
  })
  return out
}

function useIsMobile(breakpoint = 1024) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [breakpoint])
  return mobile
}

/** Parse `#visualizer?room=&floor=&wall=&scale=` deep-link params. */
function parseVisualizerHash() {
  if (typeof window === 'undefined') return {}
  const hash = window.location.hash || ''
  if (!hash.includes('visualizer')) return {}
  const q = hash.indexOf('?')
  if (q < 0) return {}
  try {
    return Object.fromEntries(new URLSearchParams(hash.slice(q + 1)).entries())
  } catch {
    return {}
  }
}

function productById(id) {
  if (!id) return null
  return strongProducts.find((p) => p.id === id) || products.find((p) => p.id === id) || null
}

function buildVisualizerHash(roomId, zoneTextures, tileScale) {
  const params = new URLSearchParams()
  params.set('room', roomId)
  Object.entries(zoneTextures || {}).forEach(([zid, p]) => {
    if (p?.id && !String(p.id).startsWith('custom-')) params.set(zid, p.id)
  })
  if (typeof tileScale === 'number') params.set('scale', tileScale.toFixed(2))
  return `#visualizer?${params.toString()}`
}

function initialFromUrl() {
  const p = parseVisualizerHash()
  const room = rooms2d.find((r) => r.id === p.room) || rooms2d[0]
  const textures = defaultZoneTextures(room.zones)
  for (const z of room.zones) {
    const pid = p[z.id]
    const prod = productById(pid)
    if (prod && surfaceMatches(prod.surface, z.surface)) textures[z.id] = prod
  }
  let scale = roomTileScale(room)
  if (p.scale && !Number.isNaN(Number(p.scale))) {
    scale = Math.min(1.8, Math.max(0.4, Number(p.scale)))
  }
  return {
    roomId: room.id,
    activeZoneId: room.zones[0].id,
    zoneTextures: textures,
    tileScale: scale,
  }
}

export default function Visualizer2D() {
  const isMobile = useIsMobile(1024)
  const boot = useMemo(() => initialFromUrl(), [])
  const [roomId, setRoomId] = useState(boot.roomId)
  const room = useMemo(
    () => rooms2d.find((r) => r.id === roomId) || rooms2d[0],
    [roomId],
  )
  const [activeZoneId, setActiveZoneId] = useState(boot.activeZoneId)
  const [zoneTextures, setZoneTextures] = useState(boot.zoneTextures)
  const [tileScale, setTileScale] = useState(boot.tileScale)
  const [groutOn, setGroutOn] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showScale, setShowScale] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const canvasRef = useRef(null)
  const skipHashWrite = useRef(false)

  // Apply deep-link when the hash changes without a full document reload
  // (same-document navigations, back/forward, shared links, e2e goto-to-hash).
  // history.replaceState (used by our hash writer) does NOT fire hashchange, so
  // this will not loop with the write effect below.
  useEffect(() => {
    const applyFromHash = () => {
      if (!(window.location.hash || '').includes('visualizer')) return
      const p = parseVisualizerHash()
      // bare #visualizer with no query — leave current room as-is
      if (Object.keys(p).length === 0) return
      const next = initialFromUrl()
      skipHashWrite.current = true
      setRoomId(next.roomId)
      setActiveZoneId(next.activeZoneId)
      setZoneTextures(next.zoneTextures)
      setTileScale(next.tileScale)
      setGroutOn(false)
      preloadRoomAssets(rooms2d.find((r) => r.id === next.roomId) || rooms2d[0])
    }
    window.addEventListener('hashchange', applyFromHash)
    return () => window.removeEventListener('hashchange', applyFromHash)
  }, [])

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (!sheetOpen || !isMobile) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sheetOpen, isMobile])

  const switchRoom = useCallback((id) => {
    const next = rooms2d.find((r) => r.id === id) || rooms2d[0]
    setRoomId(next.id)
    setActiveZoneId(next.zones[0].id)
    setZoneTextures(defaultZoneTextures(next.zones))
    setTileScale(roomTileScale(next))
    setGroutOn(false)
    preloadRoomAssets(next)
    // Warm-cache neighbour rooms for snappy tab switches
    const idx = rooms2d.findIndex((r) => r.id === next.id)
    if (idx >= 0) {
      if (rooms2d[idx + 1]) preloadRoomAssets(rooms2d[idx + 1])
      if (rooms2d[idx - 1]) preloadRoomAssets(rooms2d[idx - 1])
    }
  }, [])

  // Prefetch active room (+ neighbours) on mount
  useEffect(() => {
    preloadRoomAssets(room)
    const idx = rooms2d.findIndex((r) => r.id === room.id)
    if (idx >= 0) {
      if (rooms2d[idx + 1]) preloadRoomAssets(rooms2d[idx + 1])
      if (rooms2d[idx - 1]) preloadRoomAssets(rooms2d[idx - 1])
    }
  }, [room])

  // Keep shareable deep-link in the URL (room + zone product ids + scale)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (skipHashWrite.current) {
      skipHashWrite.current = false
      return undefined
    }
    const nextHash = buildVisualizerHash(roomId, zoneTextures, tileScale)
    if (window.location.hash !== nextHash) {
      const url = `${window.location.pathname}${window.location.search}${nextHash}`
      window.history.replaceState(null, '', url)
    }
    return undefined
  }, [roomId, zoneTextures, tileScale])

  // Catalogue "Try Visualizer" → apply product onto matching zone(s)
  useEffect(() => {
    const handler = (e) => {
      const product = e?.detail
      if (!product) return
      setZoneTextures((prev) => {
        const next = { ...prev }
        const zones = (rooms2d.find((r) => r.id === roomId) || rooms2d[0]).zones
        let applied = false
        for (const z of zones) {
          if (surfaceMatches(product.surface, z.surface)) {
            next[z.id] = product
            applied = true
            if (z.surface === 'Floor' || z.id === 'floor') {
              setActiveZoneId(z.id)
            }
          }
        }
        if (!applied) return prev
        return next
      })
      if (isMobile) setSheetOpen(true)
    }
    window.addEventListener('view-in-2d', handler)
    return () => window.removeEventListener('view-in-2d', handler)
  }, [roomId, isMobile])

  const activeZone = useMemo(
    () => room.zones.find((z) => z.id === activeZoneId) || room.zones[0],
    [room, activeZoneId],
  )

  const onSwatchPick = useCallback((zoneId, swatch) => {
    setZoneTextures((prev) => ({ ...prev, [zoneId]: swatch }))
  }, [])

  const handleCopyLink = useCallback(async () => {
    const hash = buildVisualizerHash(roomId, zoneTextures, tileScale)
    const full = `${window.location.origin}${window.location.pathname}${hash}`
    try {
      await navigator.clipboard.writeText(full)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      // Fallback for older browsers
      window.prompt('Copy this link:', full)
    }
  }, [roomId, zoneTextures, tileScale])

  const onCustomUpload = useCallback((zoneId, file) => {
    const result = validateImageFile(file)
    if (!result.ok) return
    const url = URL.createObjectURL(file)
    setZoneTextures((prev) => ({
      ...prev,
      [zoneId]: {
        id: `custom-${Date.now()}`,
        name: file.name || 'Custom tile',
        isCustom: true,
        url,
        surface: 'Both',
        size: '600x600mm',
      },
    }))
  }, [])

  const handleReset = () => {
    setZoneTextures(defaultZoneTextures(room.zones))
    setTileScale(roomTileScale(room))
    setGroutOn(false)
    setActiveZoneId(room.zones[0].id)
  }

  if (!room.zones.some((z) => z.id === activeZoneId) && room.zones[0]) {
    // no-op; next interaction via switchRoom
  }

  const handleScreenshot = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const off = document.createElement('canvas')
      await composeRoomExport(off, room, zoneTextures, {
        tileScale,
        maxWidth: isMobile ? 2048 : 3344,
        roomWidthMM: room.roomWidthMM || 3600,
        groutEnabled: groutOn,
      })
      await captureAndDownload(off)
    } catch (err) {
      console.warn('[2D visualizer] export failed, falling back to display canvas', err)
      captureAndDownload(canvasRef.current)
    } finally {
      setExporting(false)
    }
  }

  const displayMaxWidth = isMobile ? 960 : 1600

  const roomChips = (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Room models"
    >
      {rooms2d.map((r) => {
        const active = r.id === room.id
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchRoom(r.id)}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition touch-manipulation ${
              active
                ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold/40'
                : 'border-white/10 bg-charcoal text-sand active:bg-white/5'
            }`}
          >
            {r.name}
          </button>
        )
      })}
    </div>
  )

  const zoneChips = (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {room.zones.map((z) => {
        const active = z.id === activeZoneId
        const swatch = zoneTextures[z.id]
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => {
              setActiveZoneId(z.id)
              if (isMobile) setSheetOpen(true)
            }}
            className={`min-h-[44px] shrink-0 rounded-btn border px-3 py-2 text-left text-xs font-semibold transition touch-manipulation ${
              active
                ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold/40'
                : 'border-white/10 bg-charcoal text-sand'
            }`}
          >
            <span className="block">{z.label}</span>
            {swatch?.name ? (
              <span className="mt-0.5 block max-w-[9rem] truncate text-[10px] font-normal opacity-70">
                {swatch.name}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )

  const scaleControl = (
    <label className="flex items-center gap-2 text-xs text-sand/80">
      <span className="w-14 shrink-0 sm:w-16">Tile size</span>
      <span className="hidden text-[10px] text-sand/50 sm:inline">finer</span>
      <input
        type="range"
        min="0.4"
        max="1.8"
        step="0.05"
        value={tileScale}
        onChange={(e) => setTileScale(Number(e.target.value))}
        className="h-8 w-full accent-gold touch-manipulation"
        aria-label="Tile size"
      />
      <span className="hidden text-[10px] text-sand/50 sm:inline">larger</span>
      <span className="w-11 shrink-0 text-right tabular-nums text-cream/80">
        {tileScale.toFixed(2)}×
      </span>
    </label>
  )

  const canvasBlock = (
    <RoomCanvas
      room={room}
      zoneTextures={zoneTextures}
      tileScale={tileScale}
      groutEnabled={groutOn}
      canvasRef={canvasRef}
      displayMaxWidth={displayMaxWidth}
      preferLiteFirst={isMobile}
      className="border border-white/5 shadow-card"
    />
  )

  /* ─── Mobile layout ─── */
  if (isMobile) {
    return (
      <section id="visualizer" className="relative bg-charcoal pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-10">
        <div className="container-px">
          <SectionHeading
            eyebrow="Room Preview"
            title="Tile Visualizer"
            subtitle="Tap a zone, pick a tile. Fixtures stay locked."
          />

          <div className="mt-5 space-y-3">
            {roomChips}

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-cream">{room.name}</p>
                <p className="truncate text-[11px] text-sand/65">{room.blurb}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex h-10 min-w-[2.75rem] items-center justify-center gap-1 rounded-btn border border-white/10 bg-charcoal px-2.5 text-[11px] font-medium text-sand touch-manipulation"
                  aria-label="Reset tiles"
                >
                  <Icon name="compass" className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Reset</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-btn border border-white/10 bg-charcoal px-2.5 text-[11px] font-medium text-sand touch-manipulation"
                  aria-label="Copy share link"
                >
                  {linkCopied ? 'Copied' : 'Link'}
                </button>
                <button
                  type="button"
                  onClick={handleScreenshot}
                  disabled={exporting}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-btn border border-gold/40 bg-gold/10 px-2.5 text-[11px] font-semibold text-gold touch-manipulation disabled:opacity-60"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  {exporting ? '…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Preview — keep in view while scrolling controls below */}
            <div className="sticky top-14 z-10 -mx-1 rounded-card bg-charcoal/95 p-1 backdrop-blur-sm">
              {canvasBlock}
            </div>

            <div className="space-y-2 rounded-card border border-white/10 bg-charcoal-800/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sand/50">
                Active zone
              </p>
              {zoneChips}

              <button
                type="button"
                onClick={() => setShowScale((v) => !v)}
                className="flex w-full items-center justify-between py-1 text-left text-[11px] text-sand/70 touch-manipulation"
              >
                <span>Tile size · {tileScale.toFixed(2)}×</span>
                <span className="text-gold">{showScale ? 'Hide' : 'Adjust'}</span>
              </button>
              {showScale && (
                <div className="space-y-2 border-t border-white/5 pt-2">
                  {scaleControl}
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-sand/80">
                    <input
                      type="checkbox"
                      checked={groutOn}
                      onChange={(e) => setGroutOn(e.target.checked)}
                      className="h-4 w-4 accent-gold"
                    />
                    Show fine grout lines
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky bottom bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-charcoal-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-btn bg-gold px-4 py-3 text-sm font-semibold uppercase tracking-wide text-ink touch-manipulation active:brightness-95"
          >
            <Icon name="search" className="h-4 w-4" />
            Choose tiles · {activeZone.label}
          </button>
        </div>

        {/* Bottom sheet — tile browser */}
        {sheetOpen && (
          <>
            <button
              type="button"
              aria-label="Close tile picker"
              className="fixed inset-0 z-40 bg-charcoal/65 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choose tiles"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] min-w-0 flex-col rounded-t-2xl border-t border-gold/30 bg-charcoal-800 shadow-card"
            >
              <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-gold/40" />
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-cream">Choose tiles</h3>
                  <p className="truncate text-[11px] text-sand/60">
                    {activeZone.label}
                    {zoneTextures[activeZone.id]?.name
                      ? ` · ${zoneTextures[activeZone.id].name}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-cream touch-manipulation"
                  aria-label="Close"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>

              <div className="shrink-0 border-b border-white/5 px-4 pb-3">
                {zoneChips}
              </div>

              {/*
                min-w-0 is required so ZonePicker's horizontal swatch strip can
                overflow-x-scroll inside this vertical sheet scroller.
              */}
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3">
                <ZonePicker
                  zone={activeZone}
                  activeZoneId={activeZoneId}
                  zoneTextures={zoneTextures}
                  onSwatchPick={onSwatchPick}
                  onActivateZone={setActiveZoneId}
                  onCustomUpload={onCustomUpload}
                  products={strongProducts}
                  compact
                />
              </div>

              <div className="shrink-0 border-t border-white/10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="flex w-full min-h-[48px] items-center justify-center rounded-btn bg-gold text-sm font-semibold uppercase tracking-wide text-ink touch-manipulation"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    )
  }

  /* ─── Desktop layout ─── */
  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="Room Preview"
          title="Tile Visualizer"
          subtitle="Apply real catalogue tiles onto lifestyle room photos. Floor and wall independently; fixtures stay locked from the photo overlay."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)] lg:items-start">
          <div className="space-y-3">
            {rooms2d.length > 1 && roomChips}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-cream">{room.name}</p>
                <p className="text-xs text-sand/70">
                  {room.blurb} · {strongProducts.length} HQ tiles
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-white/10 bg-charcoal px-3 py-1.5 text-xs font-medium text-sand transition hover:border-gold/40 hover:text-cream"
                >
                  <Icon name="compass" className="h-3.5 w-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-white/10 bg-charcoal px-3 py-1.5 text-xs font-medium text-sand transition hover:border-gold/40 hover:text-cream"
                >
                  {linkCopied ? 'Link copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleScreenshot}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Download HQ'}
                </button>
              </div>
            </div>

            {canvasBlock}

            {scaleControl}

            <label className="flex cursor-pointer items-center gap-2 text-xs text-sand/80">
              <input
                type="checkbox"
                checked={groutOn}
                onChange={(e) => setGroutOn(e.target.checked)}
                className="accent-gold"
              />
              Show fine grout lines
            </label>

            <div className="flex flex-wrap gap-3 text-[11px] text-sand/70">
              {room.zones.map((z) => (
                <span key={z.id} className="rounded-btn border border-white/10 bg-charcoal px-2 py-1">
                  <span className="text-gold">{z.label}:</span>{' '}
                  {zoneTextures[z.id]?.name || '—'}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {zoneChips}

            <p className="text-[11px] text-sand/60">
              Active zone:{' '}
              <strong className="text-cream">{activeZone.label}</strong>
              {' — '}swatches apply only here. Soft/empty pipeline tiles are hidden.
            </p>

            <ZonePicker
              zone={activeZone}
              activeZoneId={activeZoneId}
              zoneTextures={zoneTextures}
              onSwatchPick={onSwatchPick}
              onActivateZone={setActiveZoneId}
              onCustomUpload={onCustomUpload}
              products={strongProducts}
            />

            <p className="text-[11px] leading-relaxed text-sand/55">
              Preview paints at HQ textures for a clean first look. Download HQ exports at full room
              resolution.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
