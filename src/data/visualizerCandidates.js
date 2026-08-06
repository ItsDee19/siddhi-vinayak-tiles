// ---------------------------------------------------------------------------
// Every tile product the 3D visualizer could offer, before quality filtering.
//
// Deliberately free of any dependency on visualizerTileManifest.json: this is
// the list scripts/build_visualizer_tiles.mjs reads to decide which source
// images to process, and that script runs under plain Node with no bundler
// (Node cannot import JSON without an import attribute). The filtered,
// actually-offered list lives in visualizerCatalogue.js.
// ---------------------------------------------------------------------------

import { products } from './catalogue.js'

// PDF-derived Sky 12x18 wall textures belong to the 3D picker only. Keeping
// them here prevents the public catalogue section from changing while still
// making the extracted tile faces available as thumbnails and GLB textures.
const skyPages = Array.from({ length: 73 }, (_, index) => index + 1)
  .filter((page) => page !== 50) // page 50 produced an empty extraction

// Most PDF pages contain three extracted faces (light, feature, dark). A few
// pages contain only one or two usable faces after label removal.
const singleFacePages = new Set([40, 54, 64, 70])
const twoFacePages = new Set([71])
const variantsForPage = (page) => (
  singleFacePages.has(page) ? [1] : twoFacePages.has(page) ? [1, 2] : [1, 2, 3]
)

const skyVisualizerProducts = skyPages.flatMap((page) => variantsForPage(page).map((variant) => ({
  id: `sky12x18-p${String(page).padStart(3, '0')}-t${variant}`,
  name: `Sky 12x18 · Page ${String(page).padStart(2, '0')} · ${variant === 1 ? 'Light' : variant === 2 ? 'Feature' : 'Dark'}`,
  category: 'Tiles',
  subCategory: 'Wall Tiles',
  size: '300x450mm',
  finish: 'Glossy',
  color: '#e5dec9',
  accent: '#b89f78',
  surface: 'Wall',
  priceRange: 'Budget-Mid',
  imageUrl: null,
  textureUrl: `/assets/catalogue/clean_swatches/sky12x18-p${page}-t${variant}-clean.webp`,
  tags: ['wall', 'ceramic', '12x18inch', 'sky-collection', 'pdf-extracted'],
  featured: false,
})))

const sunfloraFaceCounts = {
  3: 3, 4: 1, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 1,
  12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 2,
  20: 3, 21: 3, 22: 3, 23: 3, 24: 1, 25: 2, 26: 1, 27: 2,
  28: 3, 29: 3, 30: 3, 31: 3, 32: 3, 33: 1, 34: 2, 35: 3, 36: 3,
}

const sunfloraVisualizerProducts = Object.entries(sunfloraFaceCounts).flatMap(([page, count]) =>
  Array.from({ length: count }, (_, index) => {
    const variant = index + 1
    return {
      id: `sunflora-2x4-p${String(page).padStart(2, '0')}-t${variant}`,
      name: `Sunflora 2x4 · Page ${String(page).padStart(2, '0')} · ${variant === 1 ? 'Light' : variant === 2 ? 'Feature' : 'Dark'}`,
      category: 'Tiles',
      subCategory: 'Floor & Wall Tiles',
      size: '600x1200mm',
      finish: 'Carving',
      color: '#e5dec9',
      accent: '#b89f78',
      surface: 'Both',
      priceRange: 'Mid-High',
      imageUrl: null,
      textureUrl: `/assets/catalogue/clean_swatches/sunflora-p${String(page).padStart(2, '0')}-t${variant}-clean.webp`,
      tags: ['floor', 'wall', 'vitrified', '2x4ft', 'sunflora-collection', 'pdf-extracted'],
      featured: false,
    }
  }),
)

const skypeVisualizerProducts = Array.from({ length: 16 }, (_, index) => {
  const page = index * 2 + 3
  return {
    id: `skype-2x4-p${String(page).padStart(2, '0')}-t1`,
    name: `SKYPE 2x4 · Page ${String(page).padStart(2, '0')}`,
    category: 'Tiles',
    subCategory: 'Floor & Wall Tiles',
    size: '600x1200mm',
    finish: 'Glossy',
    color: '#eeeae4',
    accent: '#9da9bc',
    surface: 'Both',
    priceRange: 'Mid-High',
    imageUrl: null,
    textureUrl: `/assets/catalogue/clean_swatches/skype-2x4-p${String(page).padStart(2, '0')}-t1-clean.webp`,
    tags: ['floor', 'wall', 'vitrified', '2x4ft', 'skype-collection', 'pdf-extracted'],
    featured: false,
  }
})

const gt2025Groups = [
  { from: 1, to: 2, label: '3x12 Wall', size: '76x300mm', subCategory: 'Wall Tiles', surface: 'Wall' },
  { from: 3, to: 3, label: '6x12 Wall', size: '150x300mm', subCategory: 'Wall Tiles', surface: 'Wall' },
  { from: 4, to: 16, label: '12x12 Wall', size: '300x300mm', subCategory: 'Wall Tiles', surface: 'Wall' },
  { from: 17, to: 48, label: '12x18 Wall', size: '300x450mm', subCategory: 'Wall Tiles', surface: 'Wall' },
  { from: 49, to: 70, label: '16x16 Parking', size: '400x400mm', subCategory: 'Parking Tiles', surface: 'Floor' },
  { from: 71, to: 73, label: '12x12 Parking', size: '300x300mm', subCategory: 'Parking Tiles', surface: 'Floor' },
]

const gt2025VisualizerProducts = gt2025Groups.flatMap((group) => (
  Array.from({ length: group.to - group.from + 1 }, (_, pageOffset) => {
    const page = group.from + pageOffset
    return Array.from({ length: 4 }, (_, variantOffset) => {
      const variant = variantOffset + 1
      return {
        id: `gt2025-vis-p${String(page).padStart(2, '0')}-t${variant}`,
        name: `Global Tiles 2025 · ${group.label} · P${String(page).padStart(2, '0')} · T${variant}`,
        category: 'Tiles',
        subCategory: group.subCategory,
        size: group.size,
        finish: 'Matt / Glossy',
        color: '#d8d0c4',
        accent: '#9b8977',
        surface: group.surface,
        priceRange: 'Mid-High',
        imageUrl: null,
        textureUrl: `/assets/catalogue/clean_swatches/gt-2025-p${String(page).padStart(2, '0')}-t${variant}-clean.webp`,
        tags: ['global-tiles-2025', group.label.toLowerCase(), 'pdf-extracted'],
        featured: false,
      }
    })
  }).flat()
))

const gtFloorVisualizerProducts = Array.from({ length: 70 }, (_, pageOffset) => {
  const page = pageOffset + 1
  return Array.from({ length: 2 }, (_, variantOffset) => {
    const variant = variantOffset + 1
    return {
      id: `gt-floor-2025-vis-p${String(page).padStart(2, '0')}-t${variant}`,
      name: `Global Tiles Floor · 2x4 · P${String(page).padStart(2, '0')} · T${variant}`,
      category: 'Tiles',
      subCategory: 'Floor Tiles',
      size: '600x1200mm',
      finish: 'Glossy',
      color: '#d8d0c4',
      accent: '#9b8977',
      surface: 'Floor',
      priceRange: 'Mid-High',
      imageUrl: null,
      textureUrl: `/assets/catalogue/clean_swatches/gt-floor-2025-p${String(page).padStart(2, '0')}-t${variant}-clean.webp`,
      tags: ['floor', 'vitrified', '2x4ft', 'global-tiles-floor', 'pdf-extracted'],
      featured: false,
    }
  })
}).flat()


export const visualizerCandidates = [
  ...products,
  ...skyVisualizerProducts,
  ...sunfloraVisualizerProducts,
  ...skypeVisualizerProducts,
  ...gt2025VisualizerProducts,
  ...gtFloorVisualizerProducts,
]
