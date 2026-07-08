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
//   surface       enum     Floor | Wall | Both | Countertop
//   priceRange    enum     Budget | Mid | Premium
//   imageUrl      string?  optional, real photo path
//   textureUrl    string?  optional, for 3D visualizer
//   tags          string[] e.g. ["white", "marble-look"]
//   featured      boolean
// ---------------------------------------------------------------------------

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
  { id: 'tile-001', name: 'Carrara Matte Floor', category: 'Tiles', subCategory: 'Floor Tiles', size: '600×600mm', finish: 'Matte', color: '#E8E0D5', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'marble-look', 'bathroom', 'kitchen'], featured: true },
  { id: 'tile-002', name: 'Walnut Wood-Look', category: 'Tiles', subCategory: 'Floor Tiles', size: '200×1200mm', finish: 'Matte', color: '#7c5a3c', surface: 'Floor', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['wood-look', 'living-room'] },
  { id: 'tile-003', name: 'Ivory Glossy Wall', category: 'Tiles', subCategory: 'Wall Tiles', size: '300×600mm', finish: 'Glossy', color: '#e9e1d3', surface: 'Wall', priceRange: 'Budget', imageUrl: null, textureUrl: null, tags: ['white', 'kitchen', 'bathroom'] },
  { id: 'tile-004', name: 'Slate Grey Exterior', category: 'Tiles', subCategory: 'Exterior', size: '400×400mm', finish: 'Rough', color: '#6f6e6b', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['grey', 'outdoor'] },
  // Marble
  { id: 'marble-001', name: 'Statuario White Slab', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#f1ece2', surface: 'Floor', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['white', 'veined', 'luxury'], featured: true },
  { id: 'marble-002', name: 'Crema Beige', category: 'Marble', subCategory: 'Indian', size: '8×4 ft', finish: 'Polished', color: '#e3d4bb', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['beige', 'warm'] },
  { id: 'marble-003', name: 'Noir Marquina', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#211f1d', surface: 'Floor', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['black', 'feature-wall', 'bathroom'] },
  // Granite
  { id: 'granite-001', name: 'Galaxy Black Counter', category: 'Granite', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#2a2826', surface: 'Countertop', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['black', 'kitchen'], featured: true },
  { id: 'granite-002', name: 'Pearl White', category: 'Granite', subCategory: 'Kitchen', size: '10×5 ft', finish: 'Polished', color: '#d8d2c6', surface: 'Countertop', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'kitchen'] },
  { id: 'granite-003', name: 'Steel Grey Steps', category: 'Granite', subCategory: 'Stairs', size: '4 ft wide', finish: 'Polished', color: '#5a5854', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['grey', 'stairs'] },
  // Quartz
  { id: 'quartz-001', name: 'Snow Quartz Top', category: 'Quartz', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#f4f1ea', surface: 'Countertop', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['white', 'kitchen'], featured: true },
  { id: 'quartz-002', name: 'Champagne Quartz', category: 'Quartz', subCategory: 'Backsplash', size: '600×600mm', finish: 'Polished', color: '#e4d8c2', surface: 'Wall', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['warm', 'kitchen'] },
  // Sanitaryware
  { id: 'sani-001', name: 'Modern Basin Suite', category: 'Sanitaryware', subCategory: 'Basins', size: '24×18 in', finish: 'Glossy', color: '#f4f1ec', surface: 'Countertop', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'], featured: true },
  { id: 'sani-002', name: 'Matte Black Faucet', category: 'Sanitaryware', subCategory: 'Faucets', size: 'Standard', finish: 'Matte', color: '#2c2b29', surface: 'Countertop', priceRange: 'Premium', imageUrl: null, textureUrl: null, tags: ['black', 'modern'] },
  { id: 'sani-003', name: 'Wall-Hung Closet', category: 'Sanitaryware', subCategory: 'Closets', size: 'Standard', finish: 'Glossy', color: '#eceae4', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'bathroom'] },
]
