  {
    id: 'kitchen-01',
    name: 'Open Kitchen',
    blurb: 'Floor + backsplash wall',
    baseUrl: '/2d-rooms/kitchen-01/base.png',
    overlayUrl: '/2d-rooms/kitchen-01/overlay-locked.png',
    roomWidthMM: 4200,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/kitchen-01/mask-floor.png' },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/kitchen-01/mask-wall.png' },
    ],
  },
