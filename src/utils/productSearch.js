import productFacets from '../data/productFacets.json'

// ---------------------------------------------------------------------------
// Shared search + facet helpers for the catalogue grid and the 3D visualizer's
// per-zone tile picker. Both need to answer the same two questions — "does this
// product match what the customer typed" and "what bucket does it fall in" —
// and they must answer them identically, or a tile found in one place is
// missing from the other.
// ---------------------------------------------------------------------------

// Sizes are written inconsistently across the five source catalogues: the same
// 600x1200 tile appears as "600×1200mm" (Unicode multiplication sign) on 140
// products and "600x1200mm" (ASCII x) on 50. Left as-is these render as two
// separate filter pills, each hiding the other's products.
export function normalizeSize(size) {
  if (!size) return ''
  return String(size)
    .replace(/[×✕✖]/g, 'x')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/mm$/, '')
    .replace(/^(\d+)x(\d+)$/, '$1x$2')
}

// Human-facing label for a normalized size, plus the imperial name the trade
// actually uses in conversation ("2x4", "12x18") so both are searchable.
const SIZE_LABELS = {
  '300x600': { label: '300 x 600 mm', trade: '12x24 in' },
  '600x1200': { label: '600 x 1200 mm', trade: '2x4 ft' },
  '300x450': { label: '300 x 450 mm', trade: '12x18 in' },
  '300x300': { label: '300 x 300 mm', trade: '12x12 in' },
  '400x400': { label: '400 x 400 mm', trade: '16x16 in' },
  '150x300': { label: '150 x 300 mm', trade: '6x12 in' },
  '76x300': { label: '76 x 300 mm', trade: '3x12 in' },
}

export function sizeLabel(size) {
  const n = normalizeSize(size)
  return SIZE_LABELS[n]?.label || size || ''
}

export function sizeTrade(size) {
  return SIZE_LABELS[normalizeSize(size)]?.trade || ''
}

// The surfaces a product can be laid on. Mirrors utils/surfaces.js, which does
// the same normalisation for the 3D zone matching — the catalogue's own
// sub-category strings have the identical "Wall & Floor" / "Floor & Wall"
// word-order split.
export function surfacesOfProduct(product) {
  const s = String(product?.surface || '').toLowerCase()
  const out = []
  if (s.includes('floor')) out.push('Floor')
  if (s.includes('wall')) out.push('Wall')
  if (s.includes('countertop')) out.push('Countertop')
  return out
}

// Measured colour family — see scripts/build_product_facets.mjs. Falls back to
// null rather than guessing, so an unmeasured product is simply absent from
// every colour bucket instead of being dumped into a wrong one.
export function colorOf(product) {
  return productFacets[product?.id]?.color || null
}

export function colorHexOf(product) {
  return productFacets[product?.id]?.hex || null
}

// Which source catalogue a product came from. Useful as a filter because the
// shop's customers ask for ranges by name ("show me the Sunflora ones").
const COLLECTIONS = [
  { id: 'gt2025', label: 'Global Tiles 2025', test: (id) => id.startsWith('gt2025') },
  { id: 'gt-floor', label: 'Global Tiles Floor', test: (id) => id.startsWith('gt-floor') },
  { id: 'sky12x18', label: 'Sky 12x18', test: (id) => id.startsWith('sky12x18') },
  { id: 'sunflora', label: 'Sunflora', test: (id) => id.startsWith('sunflora') },
  { id: 'skype', label: 'Skype', test: (id) => id.startsWith('skype') },
  { id: 'sani', label: 'Sanitaryware', test: (id) => id.startsWith('sani') },
]

export function collectionOf(product) {
  const id = String(product?.id || '')
  return COLLECTIONS.find((c) => c.test(id)) || null
}

export function collectionLabel(collectionId) {
  return COLLECTIONS.find((c) => c.id === collectionId)?.label || collectionId
}

// ---------------------------------------------------------------------------
// Free-text search.
//
// Every whitespace-separated term must match somewhere on the product (AND),
// which is what makes progressive typing feel right: "grey" narrows, "grey 600"
// narrows further. Matching is substring-based over a haystack that includes
// the product name, its code, size in both metric and trade notation, finish,
// surface, colour family and collection — so "2x4", "gt-floor-c001", "anilaz",
// "glossy" and "terracotta" all find something.
// ---------------------------------------------------------------------------
function haystack(product) {
  if (product.__haystack) return product.__haystack
  const parts = [
    product.name,
    product.id,
    product.size,
    normalizeSize(product.size),
    sizeTrade(product.size),
    product.finish,
    product.surface,
    product.subCategory,
    product.category,
    colorOf(product),
    collectionOf(product)?.label,
  ]
  const value = parts.filter(Boolean).join(' ').toLowerCase().replace(/[×✕✖]/g, 'x')
  // Cached on the product object: the catalogue re-filters on every keystroke
  // over 557 products, and rebuilding these strings each time is pure waste.
  Object.defineProperty(product, '__haystack', { value, enumerable: false })
  return value
}

export function matchesQuery(product, query) {
  const q = String(query || '').trim().toLowerCase().replace(/[×✕✖]/g, 'x')
  if (!q) return true
  const hay = haystack(product)
  return q.split(/\s+/).every((term) => hay.includes(term))
}
