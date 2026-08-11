{
    id: 'large-bathroom-b',
    name: 'Large Bathroom',
    blurb: 'PRD Model B · floor + wall · auto-mask draft',
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
