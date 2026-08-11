  {
    id: 'feature-wall-d',
    name: 'Feature Wall',
    blurb: 'PRD Model D · 30×10 ft wall',
    baseUrl: '/2d-rooms/feature-wall-d/base.png',
    overlayUrl: '/2d-rooms/feature-wall-d/overlay-locked.png',
    roomWidthMM: 9144,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'wall', label: 'Full Wall', surface: 'Wall', maskUrl: '/2d-rooms/feature-wall-d/mask-wall.png' },
      { id: 'wall-lower', label: 'Lower Band', surface: 'Wall', maskUrl: '/2d-rooms/feature-wall-d/mask-wall-lower.png' },
      { id: 'wall-upper', label: 'Upper Band', surface: 'Wall', maskUrl: '/2d-rooms/feature-wall-d/mask-wall-upper.png' }
    ],
  },
