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

import { importedProducts } from './importedCatalogue'

export const subCategories = {
  tiles:        ['Floor Tiles', 'Wall Tiles', 'Exterior', 'Décor'],
  marble:       ['Italian', 'Indian', 'Statuario', 'Plain'],
  granite:      ['Kitchen', 'Stairs', 'Outdoor', 'Countertop'],
  quartz:       ['Countertop', 'Backsplash', 'Feature Wall'],
  sanitaryware: ['Basins', 'Faucets', 'Closets', 'Showers'],
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
