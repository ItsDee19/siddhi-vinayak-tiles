// Quality gate for the 2D lifestyle visualizer only.
// Built offline from visualizer_tiles file size + pixel dimensions.
// Weak pipeline outputs (near-empty WebPs) look soft when tiled on a large photo;
// they remain available to 3D if needed, but 2D prefers strong tiles.

import tileQuality from './visualizerTileQuality.json'
import { tileEntry } from './visualizerTiles.js'

function manifestKey(textureUrl) {
  return textureUrl.replace('/swatches/', '/clean_swatches/').split('/').pop()
}

/** True when the product has a high-quality seamless desktop tile. */
export function isStrong2dTile(product) {
  if (!product) return false
  if (product.isCustom && product.url) return true
  if (!product.textureUrl) return false
  const entry = tileEntry(product)
  if (!entry) return false
  const q = tileQuality[manifestKey(product.textureUrl)]
  // Missing quality row → allow if pipeline entry exists (forward-compatible).
  if (!q) return true
  return !!q.strong
}

/** Prefer mobile (lite) then upgrade to desktop (full). */
export function tileUrl2d(product, tier = 'full') {
  if (!product?.textureUrl) return null
  const entry = tileEntry(product)
  if (!entry) return null
  if (tier === 'lite') return entry.mobile || entry.desktop || null
  return entry.desktop || entry.mobile || null
}
