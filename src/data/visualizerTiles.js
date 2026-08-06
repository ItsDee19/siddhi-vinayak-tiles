import visualizerTileManifest from './visualizerTileManifest.json'

// ---------------------------------------------------------------------------
// Single source of truth for "does this catalogue product have a usable 3D
// tile texture, and where is it".
//
// Lives here rather than in utils/threeTextures.js because the data layer
// (visualizerCatalogue.js) needs the same answer to decide which products the
// visualizer is allowed to offer, and it must not pull three.js in to get it.
//
// The manifest is produced by scripts/build_visualizer_tiles.mjs and contains
// only sources that came through the pipeline successfully — a key being
// present IS the "usable" signal. Sources the content gate rejected (a brand
// page, a room photo, a spec table), or that failed to trim, or that are
// missing, are absent; they are recorded with their reasons in the build's
// _report.json instead, which is not shipped.
//
// There is deliberately NO fallback to the raw clean_swatches crop — that
// fallback is what put a yellow-and-blue catalogue logo on a 3D wall as
// diagonal stripes.
// ---------------------------------------------------------------------------

function manifestKey(textureUrl) {
  // Mirrors the build script: /swatches/ and /clean_swatches/ resolve to the
  // same file on disk, and the manifest is keyed by basename.
  return textureUrl.replace('/swatches/', '/clean_swatches/').split('/').pop()
}

export function tileEntry(product) {
  if (!product?.textureUrl) return null
  return visualizerTileManifest[manifestKey(product.textureUrl)] || null
}

// `tier` selects the desktop or mobile-resolution variant.
export function tileUrl(product, tier = 'full') {
  const entry = tileEntry(product)
  if (!entry) return null
  return (tier === 'lite' ? entry.mobile : entry.desktop) || null
}

// A product is offerable in the visualizer if it has a real processed tile, or
// if it carries no textureUrl at all and is rendered procedurally instead.
export function hasVisualizerTexture(product) {
  return !product?.textureUrl || !!tileEntry(product)
}
