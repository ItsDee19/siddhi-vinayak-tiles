// Registry of all 3D models. Each model:
//   id                    unique key
//   name                  display name
//   blurb                 one-line description for the tab
//   zones                 [{ id, label, surface }]  (surface = Floor | Wall | Countertop | Both)
//   presets               { [name]: { position, target } }
//   load                  () => import('./ModelX')    (lazy)
//   interactiveAutoRotate (optional) Model C: pause on pointer, resume after 5s
//   controls              (optional) list of extra UI controls — Model D / E
//   fixtures              (optional) { key: defaultVisible } — toggled via ModelShell pass-through
//
// "Floor" / "Wall" / "Countertop" surface tags are how the ZonePicker
// filters swatches (a floor zone should only show products with
// surface=Floor or Both). The catalogue products are the source.

export const models = [
  {
    id: 'bathroom-s',
    name: 'Small Bathroom',
    blurb: '8×5 ft, 3-2-3 tile bands',
    zones: [
      { id: 'floor',   label: 'Floor',        surface: 'Floor' },
      { id: 'lower',   label: 'Lower Wall',   surface: 'Wall' },
      { id: 'feature', label: 'Feature Band', surface: 'Wall' },
      { id: 'upper',   label: 'Upper Wall',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [7, 5, 8], target: [0, 3, 0] },
    },
    load: () => import('./ModelA'),
    fixtures: { shower: true },
  },
  {
    id: 'bathroom-l',
    name: 'Large Bathroom',
    blurb: '10×10 ft, 2-4-2 tile bands',
    zones: [
      { id: 'floor',   label: 'Floor',        surface: 'Floor' },
      { id: 'lower',   label: 'Lower Band',   surface: 'Wall' },
      { id: 'feature', label: 'Feature Band', surface: 'Wall' },
      { id: 'upper',   label: 'Upper Band',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [10, 6, 11], target: [0, 3, 0] },
      front:   { position: [0,  4, 14],  target: [0, 4, -5] },
      corner:  { position: [12, 5, 12],  target: [0, 3, 0] },
      topdown: { position: [0,  18, 0.01], target: [0, 0, 0] },
    },
    load: () => import('./ModelB'),
    fixtures: { shower: true, wc: true },
  },
  {
    id: 'staircase',
    name: 'Staircase',
    blurb: '22 steps, 2 flights + landing',
    zones: [
      { id: 'tread',   label: 'Tread Tile',  surface: 'Floor' },
      { id: 'riser',   label: 'Riser Tile',  surface: 'Wall' },
      { id: 'landing', label: 'Landing',     surface: 'Floor' },
    ],
    presets: {
      default:     { position: [10, 5, 14], target: [4, 4, 0] },
      side:        { position: [0,  6, 18],  target: [4, 4, 0] },
      perspective: { position: [12, 8, 10], target: [4, 4, 0] },
      landing:     { position: [12, 9, 1],   target: [11, 6.4, 0] },
    },
    load: () => import('./ModelC'),
    interactiveAutoRotate: true,
    fixtures: { nosing: true },
  },
  // Models D, E added below
]
