import { visualizerCandidates } from './visualizerCandidates.js'
import { hasVisualizerTexture } from './visualizerTiles.js'

export { visualizerCandidates }

// Used only by Visualizer and ZonePicker. The bottom catalogue section
// continues to import `products` directly from catalogue.js and is
// intentionally unchanged.
//
// Filtered to products whose texture actually survived the tile pipeline
// (scripts/build_visualizer_tiles.mjs). The PDF-page-derived entries in
// visualizerCandidates.js are generated blindly from page and variant counts,
// so a large share of them point at crops that turned out to be catalogue
// cover pages, room photography, spec tables or product shots rather than tile
// faces. Offering those as swatches is what made the 3D models show logos and
// furniture instead of tiles.
export const visualizerProducts = visualizerCandidates.filter(hasVisualizerTexture)
