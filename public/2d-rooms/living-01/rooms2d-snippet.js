  {
    id: 'living-01',
    name: 'Feature Living Wall',
    blurb: 'Floor + accent wall',
    baseUrl: '/2d-rooms/living-01/base.png',
    overlayUrl: '/2d-rooms/living-01/overlay-locked.png',
    roomWidthMM: 4800,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/living-01/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/living-01/mask-wall.png' },
    ],
  },
