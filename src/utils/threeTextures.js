import * as THREE from 'three'
import { makeMaterialCanvas } from './textures'
import visualizerTileManifest from '../data/visualizerTileManifest.json'

// Cache so we don't regenerate the same canvas/texture repeatedly.
const cache = new Map()

// Renderer's real max anisotropy, set once from ModelShell's Canvas
// onCreated. Defaults to a safe value before the renderer exists.
let maxAnisotropy = 8
export function setMaxAnisotropy(value) {
  if (typeof value === 'number' && value > 0) maxAnisotropy = value
}

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
  // Clamp single-span textures so filtering cannot pull pixels from the
  // opposite edge. Repeated procedural materials still use RepeatWrapping.
  const repeats = repeat > 1
  tex.wrapS = tex.wrapT = repeats ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = maxAnisotropy
  tex.colorSpace = THREE.SRGBColorSpace
  // Mipmaps ON: anisotropic filtering only operates through mip levels —
  // with LinearFilter/no-mipmaps, `anisotropy` above is a silent no-op and
  // minification aliasing (shimmer/moire on tiled surfaces) is uncorrected.
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
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

// Applies filtering/wrap/anisotropy but NOT repeat — repeat is set by the
// caller because it can differ per mesh (e.g. two walls of different real
// width sharing one zone texture need different repeat.x).
function applyBaseTexProps(tex) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = maxAnisotropy
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
}

function applyTexProps(tex, repeatX, repeatY) {
  applyBaseTexProps(tex)
  tex.repeat.set(repeatX, repeatY)
}

export function disposeTexture(tex) {
  if (tex && typeof tex.dispose === 'function') {
    tex.dispose()
  }
}

// repeat may be a single number (isotropic, existing callers) or left
// undefined and set by the caller afterwards via tex.repeat.set(x, y).
export function loadZoneTexture(source, repeatX = 1, size = 512, repeatY = repeatX) {
  return new Promise((resolve) => {
    if (isUrlSource(source)) {
      const url = source.url
      if (urlCache.has(url)) {
        const cached = urlCache.get(url)
        const out = cached.clone()
        applyTexProps(out, repeatX, repeatY)
        resolve(out)
        return
      }
      loader.load(
        url,
        (tex) => {
          urlCache.set(url, tex)
          const out = tex.clone()
          applyTexProps(out, repeatX, repeatY)
          resolve(out)
        },
        undefined,
        () => {
          // On URL load failure, fall back to procedural with a neutral grey
          resolve(
            getMaterialTexture(
              source.fallback || { type: 'ceramic', color: '#cfc6b4' },
              repeatX,
              size,
            ),
          )
        },
      )
    } else if (source) {
      // Procedural swatch
      resolve(getMaterialTexture(source, repeatX, size))
    } else {
      resolve(null)
    }
  })
}

// Look up the derived, border-free, wrap-safe visualizer tile for a given
// clean_swatches source URL. Falls back to the original clean_swatches URL
// when the tile was quarantined or is missing from the manifest (a handful
// of sources need manual attention — see scripts/build_visualizer_tiles.mjs).
function toVisualizerTileUrl(cleanSwatchesUrl, tier = 'full') {
  const basename = cleanSwatchesUrl.split('/').pop()
  const entry = visualizerTileManifest[basename]
  if (!entry || entry.status !== 'ok') return cleanSwatchesUrl
  const variantUrl = tier === 'lite' ? entry.mobile : entry.desktop
  return variantUrl || cleanSwatchesUrl
}

// If the source has a `textureUrl` (catalogue product), convert to a URL source.
// Useful when passing a catalogue product directly to loadZoneTexture.
// `tier` ('full' | 'lite') selects the desktop or mobile-resolution derived
// tile — see toVisualizerTileUrl above.
export function resolveZoneSource(product, tier = 'full') {
  if (!product) return null
  if (product.url) return product  // already a custom upload
  if (product.textureUrl) {
    const cleanUrl = product.textureUrl.replace('/swatches/', '/clean_swatches/')
    const tileUrl = toVisualizerTileUrl(cleanUrl, tier)
    return { id: product.id, name: product.name, url: tileUrl, finish: product.finish, size: product.size }
  }
  // No textureUrl → treat as procedural. Build a procedural swatch from
  // the catalogue product's color/category.
  return {
    id: product.id,
    type: (product.category || 'ceramic').toLowerCase(),
    color: product.color || '#cfc6b4',
    accent: product.color || '#cfc6b4',
    finish: product.finish,
  }
}

// Fetch the raw (cached) base texture for a source without applying repeat.
// Used by the grout compositor, which needs the underlying image.
export function loadRawTexture(source) {
  return new Promise((resolve) => {
    if (isUrlSource(source)) {
      const url = source.url
      if (urlCache.has(url)) { resolve(urlCache.get(url)); return }
      loader.load(
        url,
        (tex) => { urlCache.set(url, tex); resolve(tex) },
        undefined,
        () => resolve(null),
      )
    } else if (source) {
      resolve(getMaterialTexture(source, 1, 512))
    } else {
      resolve(null)
    }
  })
}

// Compose a tile texture with grout lines drawn between repeated tiles.
// `repeat` = tiles across the surface; `groutColor` colors the seams
// (pass 'none' to skip grout entirely). Our tile textures are seamless
// single tiles with no baked grout, so this adds the grout that belongs
// between tiles. (PRD §4.5 grout picker.)
export function composeGroutTexture(baseTex, groutColor, repeat, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = baseTex && baseTex.image
  const cells = Math.max(1, Math.round(repeat))
  const cw = size / cells

  if (img) {
    for (let x = 0; x < cells; x++) {
      for (let y = 0; y < cells; y++) {
        try { ctx.drawImage(img, x * cw, y * cw, cw, cw) } catch (e) { /* noop */ }
      }
    }
  } else {
    ctx.fillStyle = '#cccccc'
    ctx.fillRect(0, 0, size, size)
  }

  if (groutColor && groutColor !== 'none') {
    const gw = Math.max(1, Math.round(cw * 0.015))
    ctx.strokeStyle = groutColor === 'black' ? '#333333' : (groutColor || '#e0dad0')
    ctx.lineWidth = gw
    ctx.lineCap = 'square'
    for (let i = 1; i < cells; i++) {
      const p = Math.round(i * cw)
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.userData.groutComposited = true
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1) // tiles already baked into the canvas
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
