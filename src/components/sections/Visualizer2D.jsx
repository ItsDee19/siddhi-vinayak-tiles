import { useCallback, useMemo, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import ZonePicker from '../visualizer/ZonePicker'
import Icon from '../Icons'
import { rooms2d } from '../../data/rooms2d'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { surfaceMatches } from '../../utils/surfaces'
import { tileUrl } from '../../data/visualizerTiles'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'
import { validateImageFile } from '../../utils/imageUpload'
import RoomCanvas from '../visualizer2d/RoomCanvas'

/** Prefer products that have a real seamless tile (same gate as 3D). */
function hasSeamlessTile(p) {
  if (!p) return false
  if (p.isCustom && p.url) return true
  if (!p.textureUrl) return false
  return !!tileUrl(p, 'full')
}

function defaultZoneTextures(zones) {
  const out = {}
  const used = new Set()
  zones.forEach((z) => {
    const matching = products.filter(
      (p) => surfaceMatches(p.surface, z.surface) && hasSeamlessTile(p),
    )
    // Prefer denser / more tile-like sizes for a realistic first paint.
    const ranked = [...matching].sort((a, b) => {
      const score = (p) => {
        const s = String(p.size || '')
        if (s.includes('600x1200') || s.includes('600×1200')) return 3
        if (s.includes('300x600') || s.includes('300×600')) return 2
        if (s.includes('300x300') || s.includes('300×300')) return 1
        return 0
      }
      return score(b) - score(a)
    })
    const candidate = ranked.find((p) => !used.has(p.id)) || ranked[0]
    if (candidate) {
      out[z.id] = candidate
      used.add(candidate.id)
    }
  })
  return out
}

export default function Visualizer2D() {
  const room = rooms2d[0]
  const [activeZoneId, setActiveZoneId] = useState(room.zones[0].id)
  const [zoneTextures, setZoneTextures] = useState(() => defaultZoneTextures(room.zones))
  // 1 = natural density from product mm size; lower = finer tiles.
  const [tileScale, setTileScale] = useState(0.85)
  const canvasRef = useRef(null)

  const activeZone = useMemo(
    () => room.zones.find((z) => z.id === activeZoneId) || room.zones[0],
    [room, activeZoneId],
  )

  const onSwatchPick = useCallback((zoneId, swatch) => {
    // Always apply to the zone that owns the picker click (floor OR wall).
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
    setTileScale(0.85)
    setActiveZoneId(room.zones[0].id)
  }

  const handleScreenshot = () => {
    captureAndDownload(canvasRef.current)
  }

  return (
    <section id="visualizer-2d" className="section-pad relative border-t border-white/5 bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Lifestyle Preview"
          title="2D Room Visualizer"
          subtitle="Seamless catalogue tiles on a fixed bathroom photo — floor and wall independently. Fixtures stay locked from the photo overlay."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)] lg:items-start">
          {/* Stage */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-cream">{room.name}</p>
                <p className="text-xs text-sand/70">{room.blurb}</p>
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
                  className="inline-flex items-center gap-1.5 rounded-btn border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>

            <RoomCanvas
              room={room}
              zoneTextures={zoneTextures}
              tileScale={tileScale}
              canvasRef={canvasRef}
              className="border border-white/5 shadow-card"
            />

            <label className="flex items-center gap-3 text-xs text-sand/80">
              <span className="shrink-0 w-16">Tile size</span>
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

            {/* Live zone summary so floor vs wall assignment is obvious */}
            <div className="flex flex-wrap gap-3 text-[11px] text-sand/70">
              {room.zones.map((z) => (
                <span key={z.id} className="rounded-btn border border-white/10 bg-charcoal px-2 py-1">
                  <span className="text-gold">{z.label}:</span>{' '}
                  {zoneTextures[z.id]?.name || '—'}
                </span>
              ))}
            </div>
          </div>

          {/* Pickers */}
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
              {' — '}swatches below apply only to this surface.
            </p>

            <ZonePicker
              zone={activeZone}
              activeZoneId={activeZoneId}
              zoneTextures={zoneTextures}
              onSwatchPick={onSwatchPick}
              onActivateZone={setActiveZoneId}
              onCustomUpload={onCustomUpload}
            />

            <p className="text-[11px] leading-relaxed text-sand/55">
              Uses the same seamless tile pipeline as the 3D visualizer (not catalogue product
              photos). Select <strong className="text-sand/80">Floor</strong>, pick a swatch —
              then <strong className="text-sand/80">Wall</strong> for walls. Download exports the
              composed preview.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
