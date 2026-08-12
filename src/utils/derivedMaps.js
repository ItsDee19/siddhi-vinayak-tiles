import * as THREE from 'three'
import { computeSurfaceMaps } from './surfaceMapMath.js'

// ---------------------------------------------------------------------------
// Normal + roughness maps derived from a tile's albedo, at runtime.
//
// Every tile in the range ships exactly one map: base colour. That is the hard
// ceiling on how real a tiled wall can look — with no surface normal the tile
// is a perfectly flat sticker, so light cannot catch a grout recess, a carved
// relief or a bevelled edge, and the whole wall reads as printed wallpaper
// rather than ceramic.
//
// These are DERIVED rather than authored or shipped. A photometric scan per
// tile would be better, but 717 tiles x 2 extra maps x 2 resolutions is a
// ~50MB asset burden for a site whose entire tile library is currently 33MB.
// Deriving instead means:
//   * zero new bytes in the repo or the deploy
//   * work is done only for tiles actually applied to a surface — at most one
//     per zone, a handful per session, not 717
//   * the source image is already decoded for the albedo, so there is no
//     extra network request either
//
// The jump from no normal map to a derived one is large; the jump from derived
// to scanned is small. This buys most of the realism for none of the weight.
// ---------------------------------------------------------------------------

// Keyed by source URL + working size. Holds the un-repeated master textures;
// callers clone them to apply their own per-mesh repeat.
const cache = new Map()

/**
 * Build normal + roughness maps from a decoded image.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image decoded albedo
 * @param {string} key    cache key — use the texture's source URL
 * @param {number} size   working resolution; 512 is ample because a single
 *                        tile only ever covers a few hundred screen pixels
 * @returns {{normalMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture,
 *            roughnessMean: number}|null}
 */
export function deriveSurfaceMaps(image, key, size = 512) {
  const cacheKey = `${key}@${size}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  if (!image || !image.width) return null

  // Preserve the tile's aspect: a 4:1 elevation tile squashed to a square here
  // would produce relief running the wrong way relative to its albedo.
  const aspect = image.width / image.height
  const W = aspect >= 1 ? size : Math.max(8, Math.round(size * aspect))
  const H = aspect >= 1 ? Math.max(8, Math.round(size / aspect)) : size

  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const sctx = src.getContext('2d', { willReadFrequently: true })
  try {
    sctx.drawImage(image, 0, 0, W, H)
  } catch {
    return null // tainted canvas (cross-origin source) — skip silently
  }
  const data = sctx.getImageData(0, 0, W, H).data
  const maps = computeSurfaceMaps(data, W, H)

  const normal = document.createElement('canvas')
  normal.width = W
  normal.height = H
  normal.getContext('2d').putImageData(new ImageData(maps.normal, W, H), 0, 0)

  const rough = document.createElement('canvas')
  rough.width = W
  rough.height = H
  rough.getContext('2d').putImageData(new ImageData(maps.roughness, W, H), 0, 0)

  const normalMap = new THREE.CanvasTexture(normal)
  const roughnessMap = new THREE.CanvasTexture(rough)
  for (const tex of [normalMap, roughnessMap]) {
    // Both are DATA, not colour. Decoding them as sRGB would bend the values
    // and tilt every surface's shading.
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
  }

  const result = {
    normalMap,
    roughnessMap,
    // three multiplies material.roughness by roughnessMap.g, so a map whose
    // mean sits below 1 would quietly make the entire range glossier than the
    // finish intends. The caller divides by this to hold the average put.
    roughnessMean: maps.roughnessMean,
  }
  cache.set(cacheKey, result)
  return result
}
