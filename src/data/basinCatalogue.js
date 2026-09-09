// Verified against the product photographs already shipped with the catalogue.
// Both source crops print "LAVISH", "Product: Matt Table Top" and
// "Dimension: 455 X 340 X 135mm". The imported tile category, 300x600mm size
// and beige placeholder colour for these IDs are extraction mistakes.
//
// dimensionsMM is [width, depth, height]. The rounded rectangular silhouette
// uses a representative Blender shell, not a manufacturer CAD model. Colours
// approximate the supplied catalogue photography; no calibrated swatch exists.
// Product photography is deliberately never used as a tiled surface texture.
// Price bands retain the existing imported value; no new price tier is inferred.
export const basinProducts = [
  {
    id: 'gt2025-c398',
    name: 'Lavish Beige Tabletop Basin',
    modelName: 'LAVISH - BEIGE',
    category: 'Sanitaryware',
    subCategory: 'Tabletop Basins',
    surface: 'Countertop',
    size: '455 × 340 × 135 mm',
    dimensionsMM: [455, 340, 135],
    finish: 'Matte',
    color: '#b9a18e',
    colorFamily: 'Beige',
    accent: '#978374',
    colorSource: 'catalogue-photo-estimate',
    shape: 'rounded-rectangle',
    shapeLabel: 'Rounded rectangle',
    assetMeshName: 'basin_vanity',
    imageUrl: '/assets/catalogue/gt2025-c398.webp',
    textureUrl: null,
    priceRange: 'Mid',
    tags: ['basin', 'tabletop', 'countertop', 'lavish', 'beige', 'matte', 'ceramic'],
  },
  {
    id: 'gt2025-c402',
    name: 'Lavish Grey Tabletop Basin',
    modelName: 'LAVISH - GREY',
    category: 'Sanitaryware',
    subCategory: 'Tabletop Basins',
    surface: 'Countertop',
    size: '455 × 340 × 135 mm',
    dimensionsMM: [455, 340, 135],
    finish: 'Matte',
    color: '#5a5a5e',
    colorFamily: 'Grey',
    accent: '#404044',
    colorSource: 'catalogue-photo-estimate',
    shape: 'rounded-rectangle',
    shapeLabel: 'Rounded rectangle',
    assetMeshName: 'basin_vanity',
    imageUrl: '/assets/catalogue/gt2025-c402.webp',
    textureUrl: null,
    priceRange: 'Mid',
    tags: ['basin', 'tabletop', 'countertop', 'lavish', 'grey', 'gray', 'matte', 'ceramic'],
  },
]

export function getBasinProduct(id) {
  return basinProducts.find(product => product.id === id)
}
