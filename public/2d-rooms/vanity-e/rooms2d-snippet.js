  {
    id: 'vanity-e',
    name: 'Vanity Counter',
    blurb: 'PRD Model E · wall + counter + fascia',
    baseUrl: '/2d-rooms/vanity-e/base.png',
    overlayUrl: '/2d-rooms/vanity-e/overlay-locked.png',
    roomWidthMM: 3048,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'wall', label: 'Back Wall', surface: 'Wall', maskUrl: '/2d-rooms/vanity-e/mask-wall.png' },
      { id: 'counter', label: 'Counter Top', surface: 'Countertop', maskUrl: '/2d-rooms/vanity-e/mask-counter.png' },
      { id: 'fascia', label: 'Front Panel', surface: 'Wall', maskUrl: '/2d-rooms/vanity-e/mask-fascia.png' },
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/vanity-e/mask-floor.png' }
    ],
  },
