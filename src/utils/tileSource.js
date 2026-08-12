/**
 * Pure tile URL/source resolution — no Three.js.
 * Used by the 2D visualizer (composeRoom, ZonePicker) so canvas-2D does not
 * pull the threeTextures module (which imports `three` at top level).
 */
import { tileEntry, tileUrl } from '../data/visualizerTiles'

/**
 * Resolve a catalogue product (or custom upload) to a texture source for fill.
 * @param {object} product
 * @param {'full'|'lite'} tier
 * @returns {object|null}
 */
export function resolveZoneSource(product, tier = 'full') {
  if (!product) return null
  if (product.url) return product // custom upload already shaped
  if (product.textureUrl) {
    const url = tileUrl(product, tier)
    if (!url) return null
    return {
      id: product.id,
      name: product.name,
      url,
      finish: product.finish,
      size: product.size,
      aspect: tileEntry(product)?.aspect,
    }
  }
  // Procedural fallback from colour/category
  return {
    id: product.id,
    type: (product.category || 'ceramic').toLowerCase(),
    color: product.color || '#cfc6b4',
    accent: product.color || '#cfc6b4',
    finish: product.finish,
  }
}
