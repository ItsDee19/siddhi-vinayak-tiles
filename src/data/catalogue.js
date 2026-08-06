// ---------------------------------------------------------------------------
// Catalogue — the shop's product range. Single source of truth so the shop
// owner can add products by appending objects here.
//
// Schema (PRD §3.3):
//   id            string   unique slug
//   name          string
//   category      enum     Tiles | Marble | Granite | Quartz | Sanitaryware
//   subCategory   string   Floor Tiles | Wall Tiles | Exterior | Décor | etc.
//   size          string   e.g. "600×600mm"
//   finish        enum     Matte | Glossy | Satin | Polished | Rough
//   color         string   hex for swatch chip
//   accent        string   hex for veining/speckle/fallback procedural
//   surface       enum     Floor | Wall | Both | Countertop
//   priceRange    enum     Budget | Mid | Premium
//   imageUrl      string?  product photo / texture thumbnail for catalogue cards
//   textureUrl    string?  3D visualizer texture (tileable or product photo)
//   tags          string[] e.g. ["white", "marble-look"]
//   featured      boolean
// ---------------------------------------------------------------------------

// Explicit .js extension: scripts/build_visualizer_tiles.mjs imports this
// module chain directly under plain Node (no Vite resolver), and Node's ESM
// loader does not guess extensions.
import { importedProducts } from './importedCatalogue.js'

// NOTE: `subCategories` and the hex-distance `getColorFamily` helper used to
// live here and drove the catalogue's sub-type strip and colour filter. Both
// were removed as unusable rather than reworked:
//
//   * The sub-category lists never matched the data. Real values are
//     "Wall & Floor Tiles" (292) and "Floor & Wall Tiles" (50) — the same thing
//     with the words swapped — while the declared Exterior and Décor options
//     matched nothing at all. The catalogue now filters on Surface instead, via
//     surfacesOfProduct() in utils/productSearch.js.
//
//   * getColorFamily() classified by nearest-hex to `product.color`, but that
//     field is a placeholder: 554 of 557 products carry the identical
//     #e5dec9, so it put 556 products in "Beige" and left six of its nine
//     families empty. Colour is now measured from the tile imagery at build
//     time — see scripts/build_product_facets.mjs and data/productFacets.json.


export const finishes = ['Matte', 'Glossy', 'Satin', 'Polished', 'Rough']
export const priceRanges = ['Budget', 'Mid', 'Premium']
export const surfaces = ['Floor', 'Wall', 'Both', 'Countertop']

// Real GLOBAL TILES products (images + OCR from the two PDF catalogues).
// Floor book → surface "Floor"; 2025 book → surface "Wall" (OCR may override).
// Placeholders removed so ZonePicker + Catalogue only show real tiles.
export const products = [
  ...importedProducts,

  // Sanitaryware (fixtures — no surface textures needed)
  { id: 'sani-001', name: 'Modern Basin Suite', category: 'Sanitaryware', subCategory: 'Basins', size: '24×18 in', finish: 'Glossy', color: '#f4f1ec', accent: '#d0ccc4', surface: 'Countertop', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'], featured: true },
  { id: 'sani-002', name: 'Matte Black Faucet', category: 'Sanitaryware', subCategory: 'Faucets', size: 'Standard', finish: 'Matte', color: '#2c2b29', accent: '#1a1918', surface: 'Countertop', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['black', 'modern'] },
  { id: 'sani-003', name: 'Wall-Hung Closet', category: 'Sanitaryware', subCategory: 'Closets', size: 'Standard', finish: 'Glossy', color: '#eceae4', accent: '#d0ccc4', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'] },
]
