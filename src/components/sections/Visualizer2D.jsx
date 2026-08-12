import { useCallback, useMemo, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import ZonePicker from '../visualizer/ZonePicker'
import Icon from '../Icons'
import { rooms2d } from '../../data/rooms2d'
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

  // Prefer mid formats that tile cleanly at starter scale (avoid giant 600×1200 cells)
  if (/600\s*[x×]\s*600/i.test(size)) score += 5
  else if (/300\s*[x×]\s*600/i.test(size)) score += 4
  else if (/600\s*[x×]\s*1200/i.test(size)) score += 1
  else if (/300\s*[x×]\s*300/i.test(size)) score += 2
  else score += 2

  // Neutral stone-like names blend with lifestyle bases
  if (/(grey|gray|beige|ivory|cream|white|ash|fog|stone|cement|concrete|sand|taupe|pearl|silver|mist)/i.test(name)) {
    score += 6
  }
  // Flashy veins / metals look broken as the default “first paint”
  if (/(gold|golden|yellow|neon|copper|bronze|metallic|glitter|sparkle|black.?gold)/i.test(name)) {
    score -= 8
  }

  if (/(matte|matt|soft|honed)/i.test(finish)) score += 2
  if (/(gloss|polished|high.?gloss)/i.test(finish)) score -= 1

  // Exact surface match over "Both"
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

export default function Visualizer2D() {
  const [roomId, setRoomId] = useState(rooms2d[0].id)
  const room = useMemo(
    () => rooms2d.find((r) => r.id === roomId) || rooms2d[0],
    [roomId],
  )
  const [activeZoneId, setActiveZoneId] = useState(room.zones[0].id)
  const [zoneTextures, setZoneTextures] = useState(() => defaultZoneTextures(room.zones))
  const [tileScale, setTileScale] = useState(() => roomTileScale(room))
  const [groutOn, setGroutOn] = useState(false)
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef(null)

  const switchRoom = useCallback((id) => {
    const next = rooms2d.find((r) => r.id === id) || rooms2d[0]
    setRoomId(next.id)
    setActiveZoneId(next.zones[0].id)
    setZoneTextures(defaultZoneTextures(next.zones))
    setTileScale(roomTileScale(next))
    setGroutOn(false)
  }, [])

  const activeZone = useMemo(
    () => room.zones.find((z) => z.id === activeZoneId) || room.zones[0],
    [room, activeZoneId],
  )

  const onSwatchPick = useCallback((zoneId, swatch) => {
    setZoneTextures((prev) => ({ ...prev, [zoneId]: swatch }))
  }, [])

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

  // Keep zone id valid if room definition changes
  if (!room.zones.some((z) => z.id === activeZoneId) && room.zones[0]) {
    // no-op state fix on next render via switchRoom only
  }

  /** Full-resolution export (native room width, full tier textures). */
  const handleScreenshot = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const off = document.createElement('canvas')
      await composeRoomExport(off, room, zoneTextures, {
        tileScale,
        maxWidth: 3344,
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
            {rooms2d.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {rooms2d.map((r) => {
                  const active = r.id === room.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => switchRoom(r.id)}
                      className={`rounded-btn border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold/40'
                          : 'border-white/10 bg-charcoal text-sand hover:border-gold/30'
                      }`}
                    >
                      {r.name}
                    </button>
                  )
                })}
              </div>
            )}

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
                  onClick={handleScreenshot}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Download HQ'}
                </button>
              </div>
            </div>

            <RoomCanvas
              room={room}
              zoneTextures={zoneTextures}
              tileScale={tileScale}
              groutEnabled={groutOn}
              canvasRef={canvasRef}
              displayMaxWidth={1600}
              className="border border-white/5 shadow-card"
            />

            <label className="flex items-center gap-3 text-xs text-sand/80">
              <span className="w-16 shrink-0">Tile size</span>
              <span className="text-[10px] text-sand/50">finer</span>
              <input
                type="range"
                min="0.4"
                max="1.8"
                step="0.05"
                value={tileScale}
                onChange={(e) => setTileScale(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <span className="text-[10px] text-sand/50">larger</span>
              <span className="w-12 text-right tabular-nums text-cream/80">
                {tileScale.toFixed(2)}×
              </span>
            </label>

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
            <div className="flex flex-wrap gap-2">
              {room.zones.map((z) => {
                const active = z.id === activeZoneId
                const swatch = zoneTextures[z.id]
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setActiveZoneId(z.id)}
                    className={`rounded-btn border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold/40'
                        : 'border-white/10 bg-charcoal text-sand hover:border-gold/30'
                    }`}
                  >
                    <span className="block">{z.label}</span>
                    {swatch?.name ? (
                      <span className="mt-0.5 block max-w-[140px] truncate text-[10px] font-normal opacity-70">
                        {swatch.name}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

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
              Preview paints quickly, then upgrades to HQ textures. Download HQ exports at full room
              resolution with desktop-grade tiles.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
