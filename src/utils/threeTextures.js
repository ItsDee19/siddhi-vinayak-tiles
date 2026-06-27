import * as THREE from 'three'
import { makeMaterialCanvas } from './textures'

// Cache so we don't regenerate the same canvas/texture repeatedly.
const cache = new Map()

/**
 * Build (and cache) a THREE.CanvasTexture for a procedural material swatch.
 * @param {object} swatch { id, type, color, accent }
 * @param {number} repeat tiling repeats across the surface
 */
export function getMaterialTexture(swatch, repeat = 1) {
  const key = `${swatch.id || swatch.type + swatch.color}@${repeat}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeMaterialCanvas({
    type: swatch.type,
    color: swatch.color,
    accent: swatch.accent,
    size: 512,
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
