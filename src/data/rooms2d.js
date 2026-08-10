// 2D lifestyle room packs — photo + masks + locked overlay.
// Does not modify catalogue or 3D model registry.

export const rooms2d = [
  {
    id: 'bathroom-01',
    name: 'Modern Bathroom',
    blurb: 'Vanity wall · lifestyle photo',
    // WebP room pack (~150KB base / ~55KB overlay vs multi‑MB PNG) for fast first paint.
    baseUrl: '/2d-rooms/bathroom-01/base.webp',
    overlayUrl: '/2d-rooms/bathroom-01/overlay-locked.webp',
    // Approximate real width of the framed room for physical tile scale.
    roomWidthMM: 3600,
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
