import { useEffect, useRef, useState } from 'react'
import { makeMaterialDataURL } from '../../utils/textures'
import { getResponsiveImageProps } from '../../utils/responsiveImages'

// Renders a procedural material (or a real photo if `swatch.image` is set).
//
// Performance: generation is deferred until the thumbnail is near the viewport
// (IntersectionObserver). Until then we show the swatch's base colour, so the
// 15+ below-the-fold gallery thumbnails never block first paint. Painting +
// encoding only happens for what the user is actually about to see, and the
// result is cached module-side so repeats are free.
export default function SwatchThumb({
  swatch,
  className = '',
  size = 320,
  eager = false,
  sizes = `${size}px`,
}) {
  const ref = useRef(null)
  const [src, setSrc] = useState(swatch.image || null)
  const [failedResponsiveSource, setFailedResponsiveSource] = useState(null)
  // Use the current photograph immediately when a product changes, so neither
  // hydration nor a reused thumbnail displays the previous product's image.
  const imageSource = swatch.image || src
  const imageProps = swatch.image && failedResponsiveSource !== swatch.image
    ? getResponsiveImageProps(swatch.image, { sizes })
    : { src: imageSource }

  useEffect(() => {
    if (swatch.image) {
      setSrc(swatch.image)
      return
    }

    let cancelled = false
    const generate = () => {
      // Defer to idle time so paint isn't blocked even when in view.
      const run = () =>
        !cancelled &&
        setSrc(
          makeMaterialDataURL({
            type: swatch.type,
            color: swatch.color,
            accent: swatch.accent,
            size,
            seed: swatch.id,
          }),
        )
      if ('requestIdleCallback' in window)
        window.requestIdleCallback(run, { timeout: 600 })
      else setTimeout(run, 0)
    }

    if (eager) {
      generate()
      return () => {
        cancelled = true
      }
    }

    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      generate()
      return () => {
        cancelled = true
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          clearTimeout(backstop)
          generate()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    // Backstop: ensure the thumbnail still appears even if the observer never
    // fires (offscreen renderers) — generated lazily during idle, after the
    // critical above-the-fold paint, so it never blocks initial load.
    const backstop = setTimeout(generate, 2500)
    return () => {
      cancelled = true
      io.disconnect()
      clearTimeout(backstop)
    }
  }, [swatch, size, eager])

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: swatch.color }}
    >
      {imageSource && (
        <img
          {...imageProps}
          alt={swatch.name || swatch.title || 'Material sample'}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => {
            if (imageProps.srcSet) setFailedResponsiveSource(swatch.image)
          }}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
