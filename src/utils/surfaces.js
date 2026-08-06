// ---------------------------------------------------------------------------
// Zone/product surface matching.
//
// Zones declare one of: Floor | Wall | Countertop | Both.
// Products, however, come from five different catalogue extractions and use a
// wider vocabulary — the imported catalogue alone contains "Wall & Floor"
// (292 products) and "Floor & Wall" (50) alongside plain "Floor" and "Wall".
//
// The pickers used to test `p.surface === zone.surface || p.surface === 'Both'`,
// which silently excluded all 342 of those dual-surface products from every
// zone in the visualizer — real, named catalogue tiles that could never be
// selected on any model. Parsing the string instead of matching it exactly
// puts them back.
// ---------------------------------------------------------------------------

// Returns the set of surfaces a product can be applied to.
export function surfacesOf(value) {
  const s = String(value || '').toLowerCase()
  if (!s) return new Set()
  if (s === 'both') return new Set(['Floor', 'Wall'])
  const out = new Set()
  if (s.includes('floor')) out.add('Floor')
  if (s.includes('wall')) out.add('Wall')
  if (s.includes('countertop')) out.add('Countertop')
  return out
}

// Can `productSurface` be used on a zone tagged `zoneSurface`?
export function surfaceMatches(productSurface, zoneSurface) {
  if (!zoneSurface) return true
  const product = surfacesOf(productSurface)
  if (product.size === 0) return false
  // A zone tagged "Both" accepts anything that goes on a floor or a wall.
  if (zoneSurface === 'Both') return product.has('Floor') || product.has('Wall')
  return product.has(zoneSurface)
}
