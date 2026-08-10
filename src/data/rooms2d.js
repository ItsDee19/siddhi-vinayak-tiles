// 2D lifestyle room packs — photo + masks + locked overlay.
// Full-mask seamless tiling (createPattern). Quads unused for now —
// near-frontal bathroom photos look cleaner with flat seamless fill.

export const rooms2d = [
  {
    id: 'bathroom-01',
    name: 'Modern Bathroom',
    blurb: 'Vanity wall · lifestyle photo',
    baseUrl: '/2d-rooms/bathroom-01/base.webp',
    overlayUrl: '/2d-rooms/bathroom-01/overlay-locked.webp',
    roomWidthMM: 3600,
    maskFeatherPx: 1.5,
    grout: {
      enabled: false,
      color: '#d4cdc0',
    },
    zones: [
      {
        id: 'floor',
        label: 'Floor',
        surface: 'Floor',
        maskUrl: '/2d-rooms/bathroom-01/mask-floor.png',
      },
      {
        id: 'wall',
        label: 'Wall',
        surface: 'Wall',
        maskUrl: '/2d-rooms/bathroom-01/mask-wall.png',
      },
    ],
  },
]

export const getRoom2d = (id) => rooms2d.find((r) => r.id === id) || rooms2d[0]
