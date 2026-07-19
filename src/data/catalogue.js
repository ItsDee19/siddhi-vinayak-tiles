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
//   textureUrl    string?  3D visualizer texture (512×512px WebP, tileable)
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

export const products = [
  // Tiles
  { id: 'tile-001', name: 'Carrara Matte Floor', category: 'Tiles', subCategory: 'Floor Tiles', size: '600×600mm', finish: 'Matte', color: '#E8E0D5', accent: '#9A9488', surface: 'Floor', priceRange: 'Mid', imageUrl: '/textures/carrara-matte.webp', textureUrl: '/textures/carrara-matte.webp', tags: ['white', 'marble-look', 'bathroom', 'kitchen'], featured: true },
  { id: 'tile-002', name: 'Walnut Wood-Look', category: 'Tiles', subCategory: 'Floor Tiles', size: '200×1200mm', finish: 'Matte', color: '#7c5a3c', accent: '#4a3422', surface: 'Floor', priceRange: 'Premium', imageUrl: '/textures/walnut-wood.webp', textureUrl: '/textures/walnut-wood.webp', tags: ['wood-look', 'living-room'] },
  { id: 'tile-003', name: 'Ivory Glossy Wall', category: 'Tiles', subCategory: 'Wall Tiles', size: '300×600mm', finish: 'Glossy', color: '#e9e1d3', accent: '#cbbfa6', surface: 'Wall', priceRange: 'Budget', imageUrl: '/textures/ivory-glossy.webp', textureUrl: '/textures/ivory-glossy.webp', tags: ['white', 'kitchen', 'bathroom'] },
  { id: 'tile-004', name: 'Slate Grey Exterior', category: 'Tiles', subCategory: 'Exterior', size: '400×400mm', finish: 'Rough', color: '#6f6e6b', accent: '#4a4947', surface: 'Floor', priceRange: 'Mid', imageUrl: '/textures/slate-grey.webp', textureUrl: '/textures/slate-grey.webp', tags: ['grey', 'outdoor'] },
  // Marble
  { id: 'marble-001', name: 'Statuario White Slab', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#f1ece2', accent: '#9A9488', surface: 'Floor', priceRange: 'Premium', imageUrl: '/textures/statuario-white.webp', textureUrl: '/textures/statuario-white.webp', tags: ['white', 'veined', 'luxury'], featured: true },
  { id: 'marble-002', name: 'Crema Beige', category: 'Marble', subCategory: 'Indian', size: '8×4 ft', finish: 'Polished', color: '#e3d4bb', accent: '#a8895f', surface: 'Floor', priceRange: 'Mid', imageUrl: '/textures/crema-beige.webp', textureUrl: '/textures/crema-beige.webp', tags: ['beige', 'warm'] },
  { id: 'marble-003', name: 'Noir Marquina', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#211f1d', accent: '#d8c7ad', surface: 'Floor', priceRange: 'Premium', imageUrl: '/textures/noir-marquina.webp', textureUrl: '/textures/noir-marquina.webp', tags: ['black', 'feature-wall', 'bathroom'] },
  // Granite
  { id: 'granite-001', name: 'Galaxy Black Counter', category: 'Granite', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#2a2826', accent: '#b08d4f', surface: 'Countertop', priceRange: 'Mid', imageUrl: '/textures/galaxy-black.webp', textureUrl: '/textures/galaxy-black.webp', tags: ['black', 'kitchen'], featured: true },
  { id: 'granite-002', name: 'Pearl White', category: 'Granite', subCategory: 'Kitchen', size: '10×5 ft', finish: 'Polished', color: '#d8d2c6', accent: '#7a6f5c', surface: 'Countertop', priceRange: 'Mid', imageUrl: '/textures/pearl-white.webp', textureUrl: '/textures/pearl-white.webp', tags: ['white', 'kitchen'] },
  { id: 'granite-003', name: 'Steel Grey Steps', category: 'Granite', subCategory: 'Stairs', size: '4 ft wide', finish: 'Polished', color: '#5a5854', accent: '#26241f', surface: 'Floor', priceRange: 'Mid', imageUrl: '/textures/steel-grey.webp', textureUrl: '/textures/steel-grey.webp', tags: ['grey', 'stairs'] },
  // Quartz
  { id: 'quartz-001', name: 'Snow Quartz Top', category: 'Quartz', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#f4f1ea', accent: '#cfc6b4', surface: 'Countertop', priceRange: 'Premium', imageUrl: '/textures/snow-quartz.webp', textureUrl: '/textures/snow-quartz.webp', tags: ['white', 'kitchen'], featured: true },
  { id: 'quartz-002', name: 'Champagne Quartz', category: 'Quartz', subCategory: 'Backsplash', size: '600×600mm', finish: 'Polished', color: '#e4d8c2', accent: '#b08d4f', surface: 'Wall', priceRange: 'Premium', imageUrl: '/textures/champagne-quartz.webp', textureUrl: '/textures/champagne-quartz.webp', tags: ['warm', 'kitchen'] },
  // Sanitaryware (fixtures — no surface textures needed)
  { id: 'sani-001', name: 'Modern Basin Suite', category: 'Sanitaryware', subCategory: 'Basins', size: '24×18 in', finish: 'Glossy', color: '#f4f1ec', accent: '#d0ccc4', surface: 'Countertop', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'], featured: true },
  { id: 'sani-002', name: 'Matte Black Faucet', category: 'Sanitaryware', subCategory: 'Faucets', size: 'Standard', finish: 'Matte', color: '#2c2b29', accent: '#1a1918', surface: 'Countertop', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['black', 'modern'] },
  { id: 'sani-003', name: 'Wall-Hung Closet', category: 'Sanitaryware', subCategory: 'Closets', size: 'Standard', finish: 'Glossy', color: '#eceae4', accent: '#d0ccc4', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'] },

  // --- Auto-imported real GLOBAL TILES catalogue (OCR). Curate/rename as needed. ---
  ...importedProducts,
]
