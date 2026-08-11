  {
    id: 'staircase-c',
    name: 'Staircase',
    blurb: 'PRD Model C · 22 steps + landing',
    baseUrl: '/2d-rooms/staircase-c/base.png',
    overlayUrl: '/2d-rooms/staircase-c/overlay-locked.png',
    roomWidthMM: 1220,
    maskFeatherPx: 1.5,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'treads', label: 'Treads', surface: 'Floor', maskUrl: '/2d-rooms/staircase-c/mask-treads.png' },
      { id: 'risers', label: 'Risers', surface: 'Wall', maskUrl: '/2d-rooms/staircase-c/mask-risers.png' },
      { id: 'landing', label: 'Landing', surface: 'Floor', maskUrl: '/2d-rooms/staircase-c/mask-landing.png' }
    ],
  },
