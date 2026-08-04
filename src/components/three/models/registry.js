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
    glbUrl: '/models/model-a-bathroom.glb',
    zones: [
      { id: 'lower',   label: 'Lower Wall',   surface: 'Wall' },
      { id: 'feature', label: 'Feature Band', surface: 'Wall' },
      { id: 'upper',   label: 'Upper Wall',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [2.6, 1.8, 2.8], target: [0, 1.1, 0] },
      front:   { position: [0, 1.4, 3.2],   target: [0, 1.1, 0] },
    },
    load: () => import('./ModelA'),
    controls: ['showShower'],
    fixtures: { shower: true },
  },
  {
    id: 'bathroom-l',
    name: 'Large Bathroom',
    blurb: '10×10 ft, 2-4-2 tile bands',
    glbUrl: '/models/model-b-bathroom-lg.glb',
    zones: [
      { id: 'lower',   label: 'Lower Band',   surface: 'Wall' },
      { id: 'feature', label: 'Feature Band', surface: 'Wall' },
      { id: 'upper',   label: 'Upper Band',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [2.8, 1.9, 2.8], target: [0, 1.1, 0] },
      front:   { position: [0, 1.4, 3.2],   target: [0, 1.1, 0] },
      corner:  { position: [3.2, 1.9, 2.2], target: [0, 1.1, 0] },
      topdown: { position: [0, 4.5, 0.01],  target: [0, 0, 0] },
    },
    load: () => import('./ModelB'),
    controls: ['showShower', 'showWC'],
    fixtures: { shower: true, wc: true },
  },
  {
    id: 'staircase',
    name: 'Staircase',
    blurb: '20 steps, L-shaped + landing',
    glbUrl: '/models/model-c-staircase.glb',
    zones: [
      { id: 'tread',   label: 'Tread Tile',  surface: 'Floor' },
      { id: 'riser',   label: 'Riser Tile',  surface: 'Wall' },
      { id: 'landing', label: 'Landing',     surface: 'Floor' },
    ],
    presets: {
      default:     { position: [6, 4.5, 6],  target: [0, 2, 0] },
      side:        { position: [-6, 4, 4],   target: [0, 2, 0] },
      perspective: { position: [7, 5, -5],   target: [0, 2, 0] },
      landing:     { position: [3, 3.2, 2],  target: [0, 2, 0] },
    },
    load: () => import('./ModelC'),
    interactiveAutoRotate: true,
    fixtures: { nosing: true },
  },
  {
    id: 'feature-wall',
    name: 'Feature Wall',
    blurb: '30×10 ft facade',
    glbUrl: '/models/model-d-feature-wall.glb',
    zones: [
      { id: 'full',      label: 'Wall',         surface: 'Wall' },
      { id: 'lowerBand', label: 'Lower Band',   surface: 'Wall' },
      { id: 'upperBand', label: 'Upper Band',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [0, 0, 6], target: [0, 0, 0] },
      detail:  { position: [0, 0, 3.5], target: [0, 0, 0] },
    },
    load: () => import('./ModelD'),
    controls: ['layout', 'repeatScale', 'groutColor'],
  },
  {
    id: 'vanity',
    name: 'Vanity Counter',
    blurb: '10×5 wall + countertop',
    glbUrl: '/models/model-e-vanity.glb',
    zones: [
      { id: 'backWall',    label: 'Back Wall',    surface: 'Wall' },
      { id: 'counterTop',  label: 'Counter Top',  surface: 'Countertop' },
      { id: 'frontPanel',  label: 'Front Panel',  surface: 'Wall' },
      { id: 'sideReturns', label: 'Side Returns', surface: 'Wall' },
    ],
    presets: {
      default:      { position: [0, 1.4, 3.2],   target: [0, 1.0, 0] },
      threeQuarter: { position: [2.5, 1.6, 2.8], target: [0, 1.0, 0] },
      counterClose: { position: [0, 1.2, 1.5],   target: [0, 0.8, 0.1] },
    },
    load: () => import('./ModelE'),
    controls: ['basinStyle', 'showFaucet', 'showVanityLight'],
  },
]
