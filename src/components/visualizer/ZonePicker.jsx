import { useRef } from 'react'
import Icon from '../Icons'
import { products } from '../../data/catalogue'

// Scrollable horizontal swatch strip filtered by the zone's surface.
// Active swatch has a gold border. Includes a "Custom Upload" option.

export default function ZonePicker({
  zone,                       // { id, label, surface }
  activeZoneId,
  zoneTextures,               // { [zoneId]: swatch }
  onSwatchPick,               // (zoneId, swatch) => void
  onActivateZone,             // (zoneId) => void
  onCustomUpload,             // (zoneId, file) => void
}) {
  const fileRef = useRef(null)
  const surface = zone?.surface
  const compatible = surface
    ? products.filter((p) => p.surface === surface || p.surface === 'Both')
    : products
  const isActive = zone?.id === activeZoneId
  const current = zoneTextures[zone?.id]

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
            <span className="hidden text-[10px] text-sand/60 sm:inline">{current.name}</span>
          )}
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
            {surface}
          </span>
        </div>
      </div>

      {isActive && (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {compatible.map((p) => {
              const sel = current?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onSwatchPick(zone.id, p)}
                  title={p.name}
                  className={`relative h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                    sel ? 'border-gold shadow-glow' : 'border-transparent hover:border-sand/30'
                  }`}
                  style={{ background: p.color }}
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {sel && (
                    <Icon name="star" className="absolute right-0.5 top-0.5 h-3 w-3 text-gold" filled />
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-white/10 px-3 py-2 text-xs text-sand/70 hover:border-gold hover:text-gold"
          >
            <Icon name="send" className="h-3.5 w-3.5" /> Upload a photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onCustomUpload(zone.id, file)
              e.target.value = ''
            }}
          />
        </>
      )}
    </div>
  )
}
