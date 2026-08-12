// Floor + wall only for every model (same as bathroom-01)
export const rooms2dPrdBE = [
  {
    id: 'large-bathroom-b',
    name: 'Large Bathroom',
    blurb: 'PRD Model B · floor + wall',
    baseUrl: '/2d-rooms/large-bathroom-b/base.png',
    overlayUrl: '/2d-rooms/large-bathroom-b/overlay-locked.png',
    roomWidthMM: 3048,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/large-bathroom-b/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/large-bathroom-b/mask-wall.png' },
    ],
  },
  {
    id: 'staircase-c',
    name: 'Staircase',
    blurb: 'PRD Model C · stair floor only',
    baseUrl: '/2d-rooms/staircase-c/base.png',
    overlayUrl: '/2d-rooms/staircase-c/overlay-locked.png',
    roomWidthMM: 1220,
    maskFeatherPx: 2.0,
    lightStrength: 0.70,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Stair Floor', surface: 'Floor', maskUrl: '/2d-rooms/staircase-c/mask-floor.png' },
    ],
  },
  {
    id: 'feature-wall-d',
    name: 'Feature Wall',
    blurb: 'PRD Model D · wall only',
    baseUrl: '/2d-rooms/feature-wall-d/base.png',
    overlayUrl: '/2d-rooms/feature-wall-d/overlay-locked.png',
    roomWidthMM: 9144,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/feature-wall-d/mask-wall.png' },
    ],
  },
  {
    id: 'vanity-e',
    name: 'Vanity Counter',
    blurb: 'PRD Model E · floor + wall',
    baseUrl: '/2d-rooms/vanity-e/base.png',
    overlayUrl: '/2d-rooms/vanity-e/overlay-locked.png',
    roomWidthMM: 3048,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/vanity-e/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/vanity-e/mask-wall.png' },
    ],
  },
]
