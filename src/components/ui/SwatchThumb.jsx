import { useMemo } from 'react'
import { makeMaterialDataURL } from '../../utils/textures'

// Renders a procedural material (or a real photo if `swatch.image` is set) as
// an image. Used by the swatch picker and gallery thumbnails.
export default function SwatchThumb({ swatch, className = '', size = 320 }) {
  const src = useMemo(() => {
    if (swatch.image) return swatch.image
    return makeMaterialDataURL({
      type: swatch.type,
      color: swatch.color,
      accent: swatch.accent,
      size,
      seed: swatch.id,
    })
  }, [swatch, size])

  return (
    <img
      src={src}
      alt={swatch.name || swatch.title || 'Material sample'}
      loading="lazy"
      className={`object-cover ${className}`}
    />
  )
}
