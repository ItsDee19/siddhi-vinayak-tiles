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
    // model-b-bathroom-lg.glb is currently a byte-identical copy of
    // model-a-bathroom.glb, so without these the Large Bathroom tab renders
    // exactly the same room as the Small one. See sceneEdits.js.
    sceneEdits: {
      // The two glass partitions walling off the commode and bathtub. Each is
      // a frame plus its glass pane, so four meshes for two partitions.
      hide: [
        'Glass frame 1',
        'Glass in frame 1',
        'Glass frame 2',
        'Glass in frame 2',
      ],
      grow: {
        nodes: [
          'Mirror base',
          'Mirror',
          'tap',
          'Tap handles',
          'Sink',
          'Under sink cabinet base',
          'Top of cabinet under sink',
        ],
        // Anchored at the back-left floor corner, because the vanity already
        // touches the left wall and the back wall (z=-1). Growing from its own
        // centre would push it through both; from this corner it grows into
        // the room and upward, which is also how real furniture sits. The
        // space freed by removing the first partition is what makes the wider
        // unit fit.
        // x is the vanity's own measured left edge (-1.2516), not the wall
        // plane (-1.25): the cabinet already overhangs it by 0.0016 in the
        // stock export, and pivoting on the edge keeps that overhang exactly
        // as-is instead of scaling it up too.
        pivot: [-1.2516, 0, -1],
        // 1.28 puts the cabinet's right edge at x=-0.06, clearing the toilet
        // (left edge x=0.06), and the mirror top at y=2.03 under the 2.30
        // ceiling.
        scale: 1.28,
      },
      // Model A keeps its stock Blender materials; these give B the premium
      // read. The scene has a real <Environment> cubemap, so the metallic
      // surfaces reflect it instead of going flat black.
      materials: [
        // Frameless mirror glass — near-perfect reflector.
        { nodes: ['Mirror'], color: '#ffffff', metalness: 1, roughness: 0.02, envMapIntensity: 1.6 },
        // Brushed brass surround, picking up the site's gold accent.
        { nodes: ['Mirror base'], color: '#C49A3C', metalness: 0.9, roughness: 0.25, envMapIntensity: 1.2 },
        // Polished chrome brassware.
        { nodes: ['tap', 'Tap handles'], color: '#eef2f5', metalness: 1, roughness: 0.08, envMapIntensity: 1.4 },
        // Glazed white ceramic basin.
        { nodes: ['Sink'], color: '#ffffff', metalness: 0, roughness: 0.06, envMapIntensity: 1 },
        // Dark walnut cabinet under a pale stone counter.
        { nodes: ['Under sink cabinet base'], color: '#3B2A1E', metalness: 0.05, roughness: 0.35 },
        { nodes: ['Top of cabinet under sink'], color: '#EDE7DA', metalness: 0, roughness: 0.15, envMapIntensity: 1.1 },
      ],
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
      // Framed against the GLB's real geometry: the wall mesh is 4.47 x 2.23
      // centred on the origin (the 109-unit Plane in the file is just ground),
      // so the old y=5 aim pointed above the subject entirely. Both distances
      // also sit inside ModelShell's OrbitControls minDistance={3} /
      // maxDistance={20}, which the previous distance-22 default violated —
      // that made the initial view snap back on the first interaction.
      default: { position: [0, 0, 6],   target: [0, 0, 0] },
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
      // counterClose was [0,1.2,1.5] — camera-to-target distance ~1.46
      // is below ModelShell's global OrbitControls minDistance={3}, so
      // the view snapped back out on the first interaction. 3.3 clears it.
      counterClose: { position: [0, 1.2, 3.3],   target: [0, 0.8, 0.1] },
    },
    load: () => import('./ModelE'),
    controls: ['basinStyle', 'showFaucet', 'showVanityLight'],
  },
]
