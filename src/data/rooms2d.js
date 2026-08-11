// 2D lifestyle room packs — photo + masks + locked overlay.
// Contract for EVERY model: floor + wall only (same as bathroom-01).
// Pack: base.png · mask-floor.png · mask-wall.png · overlay-locked.png

export const rooms2d = [
  // Model A — Small Bathroom (Photopea-quality pack)
  {
    id: 'bathroom-01',
    name: 'Small Bathroom',
    blurb: 'PRD Model A · floor + wall',
    baseUrl: '/2d-rooms/bathroom-01/base.png',
    overlayUrl: '/2d-rooms/bathroom-01/overlay-locked.png',
    roomWidthMM: 2438,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/bathroom-01/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/bathroom-01/mask-wall.png' },
    ],
  },
  // Model B — Large Bathroom
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
  // Model C — Staircase
  {
    id: 'staircase-c',
    name: 'Staircase',
    blurb: 'PRD Model C · floor + wall',
    baseUrl: '/2d-rooms/staircase-c/base.png',
    overlayUrl: '/2d-rooms/staircase-c/overlay-locked.png',
    roomWidthMM: 1220,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/staircase-c/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/staircase-c/mask-wall.png' },
    ],
  },
  // Model D — Feature Wall (wall only — no floor zone)
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
  // Model E — Vanity
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

export const getRoom2d = (id) => rooms2d.find((r) => r.id === id) || rooms2d[0]
