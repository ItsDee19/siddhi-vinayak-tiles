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
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
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

/**
 * Whether the referenced element is actually on screen right now.
 *
 * Deliberately not useInView: that hook carries a 2.5s backstop that force-sets
 * `visible` so lazy content can never stay stuck behind a placeholder. Correct
 * for mounting, wrong here — the mobile action bar is position:fixed, so a
 * backstop would pop it over the hero a couple of seconds after load, which is
 * the bug this hook exists to fix. No IntersectionObserver means no bar.
 */
function useOnScreen(ref) {
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const el = ref.current
    // No IntersectionObserver: fall back to always-on rather than never-on.
    // Hiding is the enhancement here; the bar is the only way into the tile
    // browser on a phone, so losing it outright is far worse than showing it a
    // section early.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true)
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
      // A little slack so the bar is already there as the room scrolls in,
      // rather than snapping in a beat late.
      { rootMargin: '-10% 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return onScreen
}

/**
 * Viewport width, sampled on resize through rAF so a window drag coalesces to
 * one update per frame rather than one per resize event.
 */
function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  )
  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWidth(window.innerWidth))
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return width
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
  const viewportWidth = useViewportWidth()
  const sectionRef = useRef(null)
  const sectionOnScreen = useOnScreen(sectionRef)
  const boot = useMemo(() => initialFromUrl(), [])
  const [roomId, setRoomId] = useState(boot.roomId)
  const room = useMemo(
    () => rooms2d.find((r) => r.id === roomId) || rooms2d[0],
    [roomId],
  )
  const [activeZoneId, setActiveZoneId] = useState(boot.activeZoneId)
  const [zoneTextures, setZoneTextures] = useState(boot.zoneTextures)
  const [tileScale, setTileScale] = useState(boot.tileScale)
  // The slider fires on every pixel of drag; each change is a dependency of
  // RoomCanvas's compose effect, which repaints the whole room from scratch
  // (mask blur, luminance plate, pattern tiling — not cheap even after the
  // canvas-side speedups). Composing on the live value turned a drag into a
  // recompose per mousemove and stalled the frame it happened on. The slider
  // itself still tracks `tileScale` so the thumb and the "×" label stay
  // instant; only the expensive repaint waits for the drag to pause.
  const tileScaleComposed = useDebouncedValue(tileScale, 120)
  const [groutOn, setGroutOn] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showScale, setShowScale] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const canvasRef = useRef(null)

  // Apply deep-link when the hash changes without a full document reload
  // (same-document navigations, back/forward, shared links). The visualizer
  // does not auto-write the address bar, so this only runs for explicit links.
  useEffect(() => {
    const applyFromHash = () => {
      if (!(window.location.hash || '').includes('visualizer')) return
      const p = parseVisualizerHash()
      // bare #visualizer with no query — leave current room as-is
      if (Object.keys(p).length === 0) return
      const next = initialFromUrl()
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

  // NOTE: the visualizer deliberately does NOT write its state back into the
  // address bar as the user browses.
  //
  // It used to, on every room / tile / scale change, which had two bad
  // effects. The address bar filled up with
  // `#visualizer?room=…&floor=…&wall=…&scale=…` that the visitor never asked
  // for, so anyone copying the URL to share the site actually shared their own
  // half-finished tile selection. Worse, because the fragment names a section,
  // the next visit or refresh jumped straight down to the visualizer and the
  // homepage hero was never seen.
  //
  // Deep links still work in both directions without it: initialFromUrl()
  // reads the params on load, and handleCopyLink() builds the full shareable
  // URL on demand. Sharing is an explicit action, so the URL only changes when
  // the user actually asks for a link.

  // Catalogue "Try Visualizer" → apply product onto matching zone(s)
  useEffect(() => {
    const handler = (e) => {
      const product = e?.detail
      if (!product) return
      setZoneTextures((prev) => {
        const next = { ...prev }
        const zones = (rooms2d.find((r) => r.id === roomId) || rooms2d[0]).zones
        const matching = zones.filter((z) => surfaceMatches(product.surface, z.surface))
        if (matching.length === 0) return prev

        // If the zone the user is already working on can take this tile, apply
        // it there only. Rooms can now have several zones of the same surface —
        // the Small Bathroom has three wall panels — and filling all of them
        // would silently discard the other panels' selections.
        const active = matching.find((z) => z.id === activeZoneId)
        if (active) {
          next[active.id] = product
          return next
        }

        for (const z of matching) {
          next[z.id] = product
          if (z.surface === 'Floor' || z.id === 'floor') setActiveZoneId(z.id)
        }
        return next
      })
      if (isMobile) setSheetOpen(true)
    }
    window.addEventListener('view-in-2d', handler)
    return () => window.removeEventListener('view-in-2d', handler)
    // activeZoneId is read inside the handler to target the panel in focus, so
    // the listener has to be re-bound when it changes or it would close over a
    // stale one.
  }, [roomId, isMobile, activeZoneId])

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

  // Every blob: URL minted for a custom upload, so none of them outlive the
  // swatch that referenced it. An un-revoked object URL pins the entire file
  // in memory for the life of the document — with an 8MB cap per upload and no
  // limit on how many a visitor can try, that grows without bound, and the
  // image data of every tile they ever previewed stays resident.
  const objectUrlsRef = useRef(new Set())

  const onCustomUpload = useCallback((zoneId, file) => {
    const result = validateImageFile(file)
    if (!result.ok) return
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.add(url)
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

  // Release object URLs once no zone points at them any more (swatch replaced,
  // room switched, reset pressed).
  useEffect(() => {
    const inUse = new Set(
      Object.values(zoneTextures).map((t) => t?.url).filter(Boolean),
    )
    objectUrlsRef.current.forEach((url) => {
      if (!inUse.has(url)) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
      }
    })
  }, [zoneTextures])

  // ...and release whatever is still held when the visualizer unmounts.
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
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

  // The canvas is now full-bleed, so the composed bitmap has to track the
  // viewport instead of a fixed 1600. It is quantised to 320px steps and capped
  // at 2560: displayMaxWidth is a dependency of RoomCanvas's compose effect, so
  // feeding it a raw pixel width would recompose the whole room on every frame
  // of a window drag.
  const displayMaxWidth = useMemo(() => {
    if (isMobile) return 960
    const step = 320
    const dpr = Math.min(viewportWidth >= 1920 ? 1 : 1.5, 2)
    return Math.max(1280, Math.min(2560, Math.ceil((viewportWidth * dpr) / step) * step))
  }, [isMobile, viewportWidth])

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
      tileScale={tileScaleComposed}
      groutEnabled={groutOn}
      canvasRef={canvasRef}
      displayMaxWidth={displayMaxWidth}
      preferLiteFirst={isMobile}
      maxHeight={isMobile ? 'min(56vh, 460px)' : 'min(92vh, 1200px)'}
      className={
        isMobile
          ? 'overflow-hidden rounded-card border border-white/5 bg-charcoal-800 shadow-card'
          : ''
      }
    />
  )

  // Full-bleed on desktop: cancel the container's horizontal padding so the room
  // runs edge to edge.
  //
  // Width is capped by height, not the other way round, and that is deliberate.
  // The room plates are 16:9, so on any viewport wider than 16:9 a genuinely
  // edge-to-edge canvas would be taller than the screen and cut the floor off
  // below the fold — the one thing a tile visualiser must not do. Capping at
  // 92vh keeps the whole room visible and lets it grow as wide as that allows:
  // ~92% of the width on a 16:9 monitor, less on a short wide window, where the
  // plate's own aspect ratio is the binding constraint rather than this rule.
  // The leftover gutters are the section's own background, so it still reads as
  // full width with nothing framing it.
  const fullBleedCanvas = (
    <div className="-mx-5 sm:-mx-8 lg:-mx-16 xl:-mx-24">{canvasBlock}</div>
  )

  /* ─── Mobile layout ─── */
  if (isMobile) {
    return (
      <section
        ref={sectionRef}
        id="visualizer"
        className={`relative bg-charcoal pt-10 ${
          sectionOnScreen ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'pb-10'
        }`}
      >
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

        {/* Sticky bottom bar — only while the visualiser is actually on screen.
            It is position:fixed, so without this gate it floats over the hero
            and every other section from the moment the lazy visualiser mounts,
            which happens 500px early (or immediately on a #visualizer link). */}
        {sectionOnScreen && (
          <div className="fixed inset-x-0 bottom-0 z-30 animate-fade-up border-t border-gold/25 bg-charcoal-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-btn bg-gold px-4 py-3 text-sm font-semibold uppercase tracking-wide text-ink touch-manipulation active:brightness-95"
            >
              <Icon name="search" className="h-4 w-4" />
              Choose tiles · {activeZone.label}
            </button>
          </div>
        )}

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

        <div className="mt-8 space-y-3">
          <div>
            {rooms2d.length > 1 && roomChips}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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

            <div className="mt-3">{fullBleedCanvas}</div>

            <div className="mt-3 space-y-3">
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
          </div>

          {/* Tile selection sits below the room now that the room is full width. */}
          <div className="space-y-3 pt-2">
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
