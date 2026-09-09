// Client layouts A–E. Geometry is authored in metres; customer dimensions
// remain in feet. A bathroom exposes only its two banded tile walls.
const bathroomZones = heights => ['lower', 'feature', 'upper'].map((id, index) => ({
  id, label: `${['Lower', 'Middle', 'Upper'][index]} · ${heights[index]} ft`, surface: 'Wall',
}))

export const models = [
  {
    id: 'bathroom-s', name: 'Bathroom 8 × 5', letter: 'A',
    surfaceNote: 'Wall tiles only · bathroom floor fixed',
    blurb: 'Compact oak & chrome · two 8 ft walls with 3–2–3 ft bands', dimensions: '8 × 5 ft floor',
    selectionHint: 'Choose a wall band. The same band changes on both walls; the bathroom floor stays fixed.',
    zones: bathroomZones([3, 2, 3]),
    presets: {
      default: { label: 'Both walls', position: [1.03, 1.55, 0.64], target: [-0.45, 1.18, -0.6], fov: 68 },
      wall: { label: 'Wall detail', position: [0.8, 1.5, 0.6], target: [0.2, 1.35, -0.762], fov: 52 },
    },
  },
  {
    id: 'bathroom-l', name: 'Bathroom 10 × 10', letter: 'B',
    surfaceNote: 'Wall tiles only · bathroom floor fixed',
    blurb: 'Walnut, brass & a soaking tub · two 8 ft walls with 2–4–2 ft bands', dimensions: '10 × 10 ft floor',
    selectionHint: 'Choose a wall band. The same band changes on both walls; the bathroom floor stays fixed.',
    zones: bathroomZones([2, 4, 2]),
    presets: {
      default: { label: 'Both walls', position: [1.2, 1.55, 1.3], target: [-0.4, 1.18, -1.25], fov: 62 },
      wall: { label: 'Wall detail', position: [0.6, 1.5, 0.1], target: [0.3, 1.35, -1.524], fov: 52 },
    },
  },
  {
    id: 'stairs', name: 'Staircase', letter: 'C',
    blurb: 'Two flights, one intermediate landing · see the way up and down', dimensions: 'U-shaped staircase',
    selectionHint: 'Choose treads, risers or hall tiles. Treads and the intermediate landing share your selected floor tile.',
    zones: [
      { id: 'tread', label: 'Treads & landing', surface: 'Floor' },
      { id: 'riser', label: 'Risers', surface: 'Wall' },
      { id: 'floor', label: 'Hall floor', surface: 'Floor' },
      { id: 'wall', label: 'Walls', surface: 'Wall' },
    ],
    presets: {
      default: { label: 'Up & down', position: [0, 3.25, 2.15], target: [0, 1.55, -0.7], fov: 68 },
      down: { label: 'Downstairs', position: [-0.35, 3.22, 2.05], target: [-0.69, 0.75, -0.8], fov: 52 },
      up: { label: 'Upstairs', position: [0.35, 3.22, 2.05], target: [0.69, 2.6, -0.7], fov: 50 },
    },
  },
  {
    id: 'feature-wall', name: 'Wall 30 × 10', letter: 'D',
    blurb: 'A continuous tiled wall with room to judge a large-scale pattern', dimensions: '30 ft wide × 10 ft high',
    selectionHint: 'Choose a tile for the full 30 × 10 ft wall. The surrounding finishes stay fixed.',
    zones: [{ id: 'wall', label: 'Full wall', surface: 'Wall', defaultTileRole: 'feature' }],
    presets: {
      default: { label: 'Full wall', position: [0, 1.55, 6.9], target: [0, 1.45, 0], fov: 48, fitAspect: 1.5 },
      detail: { label: 'Tile detail', position: [0, 1.55, 2.3], target: [0, 1.45, 0], fov: 48 },
    },
  },
  {
    id: 'vanity', name: 'Basin wall 10 × 5', letter: 'E',
    blurb: 'One statement basin · 10 × 5 ft tiled back wall · tiled front',
    dimensions: '10 ft wide × 2 ft deep counter',
    selectionHint: 'Choose a tabletop basin from the catalogue, then compare tiles on the back wall, front panel and side returns.',
    zones: [
      { id: 'backWall', label: 'Back wall', surface: 'Wall', defaultTileRole: 'feature' },
      { id: 'frontPanel', label: 'Front panel', surface: 'Wall', defaultTileRole: 'feature' },
      { id: 'sideReturns', label: 'Side returns', surface: 'Wall' },
    ],
    presets: {
      default: { label: 'Basin & walls', position: [0.72, 1.60, 2.70], target: [0, 1.14, 0.10], fov: 49, fitAspect: 1.5 },
      detail: { label: 'Basin detail', position: [0.25, 1.50, 1.15], target: [0, 0.94, 0.33], fov: 44, fitAspect: 1 },
      front: { label: 'Front panel', position: [0.15, 1.05, 1.9], target: [0.15, 0.36, 0.6096], fov: 48 },
    },
  },
]
