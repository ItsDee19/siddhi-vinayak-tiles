import * as THREE from 'three'
import { makeMaterialCanvas } from './textures'

// Cache so we don't regenerate the same canvas/texture repeatedly.
const cache = new Map()

/**
 * Build (and cache) a THREE.CanvasTexture for a procedural material swatch.
 * Backwards-compatible export — used by the Hero tile wall and the legacy
 * single-floor visualizer path.
 * @param {object} swatch { id, type, color, accent }
 * @param {number} repeat tiling repeats across the surface
 * @param {number} size canvas resolution — keep small for tiny meshes
 */
export function getMaterialTexture(swatch, repeat = 1, size = 512) {
  const key = `${swatch.id || swatch.type + swatch.color}@${repeat}@${size}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeMaterialCanvas({
    type: swatch.type,
    color: swatch.color,
    accent: swatch.accent,
    size,
    seed: swatch.id || swatch.type + swatch.color,
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  cache.set(key, tex)
  return tex
}

// ---------------------------------------------------------------------------
// Zone texture resolver — used by the multi-zone Visualizer.
//
// `source` can be:
//   - a procedural swatch: { id, type, color, accent }      → procedural canvas
//   - a custom upload:    { id, name, url, isCustom: true } → TextureLoader
//   - a catalogue product with textureUrl: { id, ..., textureUrl: '/path' }
//                                                            → TextureLoader
//
// `loadZoneTexture` is async; pass it to a useEffect in the mesh component
// and store the resolved texture in local state. Repeats/clones are cheap
// because we cache the source texture in urlCache.
// ---------------------------------------------------------------------------

const loader = new THREE.TextureLoader()
const urlCache = new Map()

function isUrlSource(src) {
  return src && typeof src.url === 'string'
}

function applyTexProps(tex, repeat) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
}

export function loadZoneTexture(source, repeat = 1, size = 512) {
  return new Promise((resolve) => {
    if (isUrlSource(source)) {
      const url = source.url
      if (urlCache.has(url)) {
        const cached = urlCache.get(url)
        const out = cached.clone()
        applyTexProps(out, repeat)
        resolve(out)
        return
      }
      loader.load(
        url,
        (tex) => {
          urlCache.set(url, tex)
          const out = tex.clone()
          applyTexProps(out, repeat)
          resolve(out)
        },
        undefined,
        () => {
          // On URL load failure, fall back to procedural with a neutral grey
          resolve(
            getMaterialTexture(
              source.fallback || { type: 'ceramic', color: '#cfc6b4' },
              repeat,
              size,
            ),
          )
        },
      )
    } else if (source) {
      // Procedural swatch
      resolve(getMaterialTexture(source, repeat, size))
    } else {
      resolve(null)
    }
  })
}

// If the source has a `textureUrl` (catalogue product), convert to a URL source.
// Useful when passing a catalogue product directly to loadZoneTexture.
export function resolveZoneSource(product) {
  if (!product) return null
  if (product.url) return product  // already a custom upload
  if (product.textureUrl) {
    return { id: product.id, name: product.name, url: product.textureUrl }
  }
  // No textureUrl → treat as procedural. Build a procedural swatch from
  // the catalogue product's color/category.
  return {
    id: product.id,
    type: (product.category || 'ceramic').toLowerCase(),
    color: product.color || '#cfc6b4',
    accent: product.color || '#cfc6b4',
  }
}
