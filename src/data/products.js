// ---------------------------------------------------------------------------
// Product config. Categories (for nav/picker) and swatches (used by the Hero
// tile wall and the legacy single-floor visualizer) live here. The full
// product catalogue with PRD schema lives in ./catalogue.js.
// ---------------------------------------------------------------------------

export const categories = [
  {
    id: 'tiles',
    name: 'Tiles',
    blurb: 'Floor & wall tiles in ceramic, vitrified and wood-look finishes for every room.',
    icon: 'tiles',
  },
  {
    id: 'marble',
    name: 'Marble',
    blurb: 'Soft veining and timeless elegance — Indian and imported marble slabs.',
    icon: 'marble',
  },
  {
    id: 'granite',
    name: 'Granite',
    blurb: 'Hard-wearing, speckled granite for kitchens, stairs and high-traffic floors.',
    icon: 'granite',
  },
  {
    id: 'quartz',
    name: 'Quartz',
    blurb: 'Engineered quartz surfaces — consistent, stain-resistant and contemporary.',
    icon: 'quartz',
  },
  {
    id: 'sanitaryware',
    name: 'Sanitaryware',
    blurb: 'Basins, closets, faucets and complete bathroom fittings from trusted brands.',
    icon: 'sanitaryware',
  },
]

// Swatches feed the Hero floating tile wall. The multi-zone Visualizer
// uses the full catalogue (./catalogue.js) instead.
export const swatches = [
  // Tiles
  { id: 'ceramic-ivory', category: 'tiles', name: 'Ivory Ceramic', type: 'ceramic', color: '#e9e1d3', accent: '#cbbfa6' },
  { id: 'wood-walnut', category: 'tiles', name: 'Walnut Wood-Look', type: 'wood', color: '#7c5a3c', accent: '#4a3422' },
  { id: 'terrazzo-sand', category: 'tiles', name: 'Sand Terrazzo', type: 'terrazzo', color: '#e6ddca', accent: '#9a7d4d' },
  { id: 'ceramic-slate', category: 'tiles', name: 'Slate Grey', type: 'ceramic', color: '#6f6e6b', accent: '#4a4947' },
  // Marble
  { id: 'marble-statuario', category: 'marble', name: 'Statuario White', type: 'marble', color: '#f1ece2', accent: '#9a9488' },
  { id: 'marble-beige', category: 'marble', name: 'Crema Beige', type: 'marble', color: '#e3d4bb', accent: '#a8895f' },
  { id: 'marble-emerald', category: 'marble', name: 'Forest Green', type: 'marble', color: '#33473b', accent: '#cdbf8e' },
  { id: 'marble-noir', category: 'marble', name: 'Noir Marquina', type: 'marble', color: '#211f1d', accent: '#d8c7ad' },
  // Granite
  { id: 'granite-pearl', category: 'granite', name: 'Pearl White', type: 'granite', color: '#d8d2c6', accent: '#7a6f5c' },
  { id: 'granite-black', category: 'granite', name: 'Galaxy Black', type: 'granite', color: '#2a2826', accent: '#b08d4f' },
  { id: 'granite-rose', category: 'granite', name: 'Rosewood Red', type: 'granite', color: '#7d4a3e', accent: '#2c1c18' },
  { id: 'granite-steel', category: 'granite', name: 'Steel Grey', type: 'granite', color: '#5a5854', accent: '#26241f' },
  // Quartz
  { id: 'quartz-snow', category: 'quartz', name: 'Snow Quartz', type: 'quartz', color: '#f4f1ea', accent: '#cfc6b4' },
  { id: 'quartz-mist', category: 'quartz', name: 'Grey Mist', type: 'quartz', color: '#cdc9c2', accent: '#8c8a86' },
  { id: 'quartz-onyx', category: 'quartz', name: 'Onyx Black', type: 'quartz', color: '#2c2a28', accent: '#9c8a66' },
  { id: 'quartz-champagne', category: 'quartz', name: 'Champagne', type: 'quartz', color: '#e4d8c2', accent: '#b08d4f' },
]
