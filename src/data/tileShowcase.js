// ---------------------------------------------------------------------------
// Curated slide set for the homepage's 3D showcase carousel (replaced the
// interactive 2D room visualizer — see docs/2d-visualizer removal notes in
// the archive/2d-visualizer branch for the tool this superseded).
//
// The catalogue spans 5 real product ranges, identifiable by id prefix (no
// explicit `range` field on the product objects):
//   gt        Global Tiles Floor    140 products,   6 featured
//   gt2025    Global Tiles 2025     292 products,  10 featured
//   skype     Skyline                16 products,  16 featured
//   sunflora  Sunflora               34 products,  34 featured
//   sky12x18  Sky 12x18              72 products,  10 featured
//
// A naive global `featured` filter would drown out `gt` and `gt2025` (the
// two biggest ranges) since `sunflora`/`skype` are 100% featured — so this
// picks a fixed number PER range instead, preferring featured products
// within each range and falling back to the range's first entries only if
// it doesn't have enough featured+imaged products (defensive; every range
// currently clears the bar).
// ---------------------------------------------------------------------------
import { products } from './catalogue'

const RANGE_LABELS = {
  gt: 'Global Tiles Floor',
  gt2025: 'Global Tiles 2025',
  skype: 'Skyline',
  sunflora: 'Sunflora',
  sky12x18: 'Sky 12×18',
}

const SLIDES_PER_RANGE = 2

const rangeOf = (product) => product.id.split('-')[0]

// A couple of OCR-extracted entries are catalogue-book artifacts, not real
// tiles (e.g. "Cover (not a product)", "Divider (not a product)" from the
// Sunflora range's scanned cover/section pages) — excluded so they can never
// end up as a customer-facing showcase slide.
const isRealProduct = (p) => !/not a product/i.test(p.name)

function pickFromRange(range) {
  const pool = products.filter((p) => rangeOf(p) === range && p.imageUrl && isRealProduct(p))
  const featured = pool.filter((p) => p.featured)
  const source = featured.length >= SLIDES_PER_RANGE ? featured : pool
  return source.slice(0, SLIDES_PER_RANGE)
}

export const showcaseSlides = Object.keys(RANGE_LABELS).flatMap((range) =>
  pickFromRange(range).map((product) => ({
    id: product.id,
    title: product.name,
    subtitle: `${RANGE_LABELS[range]} · ${product.size}`,
    image: product.imageUrl,
    product,
  })),
)
