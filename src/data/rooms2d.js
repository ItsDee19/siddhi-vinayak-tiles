// 2D lifestyle room packs — photo + masks + locked overlay + plane quads.
// Quads are normalized [0–1] image coords: [TL, TR, BR, BL].
// Tune corners if perspective looks off; masks still punch fixtures precisely.

export const rooms2d = [
  {
    id: 'bathroom-01',
    name: 'Modern Bathroom',
    blurb: 'Vanity wall · lifestyle photo',
    // WebP room pack (~150KB base / ~55KB overlay) for fast first paint.
    baseUrl: '/2d-rooms/bathroom-01/base.webp',
    overlayUrl: '/2d-rooms/bathroom-01/overlay-locked.webp',
    // Approximate real width of the framed room for physical tile scale.
    roomWidthMM: 3600,
    // Room depth used for floor tile scale along the perspective axis.
    roomDepthMM: 2800,
    // Soft mask edge (px at full 3344 width; scaled with canvas).
    maskFeatherPx: 2.5,
    // Default grout look (overridable per product later).
    grout: {
      enabled: true,
      mm: 2.5,
      color: '#d4cdc0',
    },
    zones: [
      {
        id: 'floor',
        label: 'Floor',
        surface: 'Floor',
        maskUrl: '/2d-rooms/bathroom-01/mask-floor.png',
        // Floor trapezoid: wall line → bottom of frame.
        // Order: top-left, top-right, bottom-right, bottom-left (normalized).
        quad: [
          [0.045, 0.635],
          [0.955, 0.635],
          [1.0, 1.0],
          [0.0, 1.0],
        ],
        // How many tile major-edges across the near (bottom) edge of the floor.
        tilesAcrossNear: 6,
      },
      {
        id: 'wall',
        label: 'Wall',
        surface: 'Wall',
        maskUrl: '/2d-rooms/bathroom-01/mask-wall.png',
        // Main back wall — slight perspective (wider at bottom).
        quad: [
          [0.035, 0.12],
          [0.965, 0.12],
          [0.955, 0.635],
          [0.045, 0.635],
        ],
        tilesAcrossNear: 5.5,
      },
    ],
  },
]

export const getRoom2d = (id) => rooms2d.find((r) => r.id === id) || rooms2d[0]
