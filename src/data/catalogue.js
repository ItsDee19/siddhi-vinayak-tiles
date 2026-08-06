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

export const subCategories = {
  tiles:        ['Floor Tiles', 'Wall Tiles', 'Exterior', 'Décor'],
  marble:       ['Italian', 'Indian', 'Statuario', 'Plain'],
  granite:      ['Kitchen', 'Stairs', 'Outdoor', 'Countertop'],
  quartz:       ['Countertop', 'Backsplash', 'Feature Wall'],
  sanitaryware: ['Basins', 'Faucets', 'Closets', 'Showers'],
}

export const colorFamilies = {
  White: '#FFFFFF',
  Black: '#000000',
  Grey: '#808080',
  Beige: '#F5F5DC',
  Brown: '#A52A2A',
  Blue: '#0000FF',
  Green: '#008000',
  Red: '#FF0000',
  Gold: '#FFD700',
  Multi: null,
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function getColorFamily(hexColor) {
  if (!hexColor) return 'Multi';
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 'Multi';

  let minDistance = Infinity;
  let closestFamily = 'Multi';

  for (const [family, refHex] of Object.entries(colorFamilies)) {
    if (!refHex) continue;
    const refRgb = hexToRgb(refHex);
    const distance = Math.sqrt(
      Math.pow(rgb.r - refRgb.r, 2) +
      Math.pow(rgb.g - refRgb.g, 2) +
      Math.pow(rgb.b - refRgb.b, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestFamily = family;
    }
  }
  return closestFamily;
}

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
