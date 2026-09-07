import { surfacesOf } from './surfaces.js'

// A preview promises the photographed tile on a supported room surface.
// Sanitariware, missing imagery and crops rejected by the tile pipeline do
// not become generic colour swatches under the same product name.
export function isPreviewableTile(product, textureEntry) {
  if (!product?.textureUrl || !textureEntry) return false
  const surfaces = surfacesOf(product.surface)
  return surfaces.has('Floor') || surfaces.has('Wall')
}

/** Retain the latest selection until the lazily mounted room can receive it. */
export function createVisualizerSelectionBridge(isEligible) {
  const listeners = new Set()
  let pending = null
  return {
    publish(product) {
      if (!isEligible(product)) return false
      if (!listeners.size) pending = product
      else {
        pending = null
        for (const listener of [...listeners]) listener(product)
      }
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      if (pending) {
        const product = pending
        pending = null
        listener(product)
      }
      return () => { listeners.delete(listener) }
    },
  }
}
