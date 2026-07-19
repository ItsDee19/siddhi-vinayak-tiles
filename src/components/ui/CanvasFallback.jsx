import { useEffect, useRef } from 'react'
import { makeMaterialCanvas } from '../../utils/textures'

// Static, no-WebGL fallback. Renders a tasteful grid of procedural material
// swatches so the 3D-less experience still feels like a stone showroom.
export default function CanvasFallback({ swatchList = [], className = '', label }) {
  const wrapRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.querySelectorAll('canvas').forEach((c) => {
      const swatch = swatchList[Number(c.dataset.idx)]
      if (!swatch) return
      const made = makeMaterialCanvas({
        type: swatch.type,
        color: swatch.color,
        accent: swatch.accent,
        size: 256,
        seed: swatch.id,
      })
      const ctx = c.getContext('2d')
      c.width = c.height = 256
      ctx.drawImage(made, 0, 0)
    })
  }, [swatchList])

  return (
    <div
      ref={wrapRef}
      className={`grid h-full w-full grid-cols-3 gap-1 overflow-hidden rounded-2xl ${className}`}
    >
      {swatchList.map((s, i) => (
        <div key={`${s.id}-${i}`} className="relative aspect-square overflow-hidden">
          <canvas
            data-idx={i}
            className="h-full w-full object-cover"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ))}
      {label && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-charcoal/70 px-3 py-1 text-[10px] uppercase tracking-wider text-sand">
          {label}
        </span>
      )}
    </div>
  )
}
