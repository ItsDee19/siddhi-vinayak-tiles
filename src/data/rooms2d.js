// 2D lifestyle room packs — photo + masks + locked overlay.
// Prefer WebP when present (built by scripts/build_2d_room_webp.mjs); PNG remains for tools.

const W = (room, file) => `/2d-rooms/${room}/${file}.webp`

export const rooms2d = [
  // Model A — Small Bathroom (Photopea-quality pack)
  {
    id: 'bathroom-01',
    name: 'Small Bathroom',
    blurb: 'PRD Model A · floor + wall',
    baseUrl: W('bathroom-01', 'base'),
    overlayUrl: W('bathroom-01', 'overlay-locked'),
    roomWidthMM: 2438,
    defaultTileScale: 0.65,
    maskFeatherPx: 2.2,
    lightStrength: 0.75,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      {
        id: 'floor',
        label: 'Floor',
        surface: 'Floor',
        maskUrl: W('bathroom-01', 'mask-floor'),
      },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: W('bathroom-01', 'mask-wall') },
    ],
  },
  // Model B — Large Bathroom
  {
    id: 'large-bathroom-b',
    name: 'Large Bathroom',
    blurb: 'PRD Model B · floor + wall',
    baseUrl: W('large-bathroom-b', 'base'),
    overlayUrl: W('large-bathroom-b', 'overlay-locked'),
    roomWidthMM: 4000,
    defaultTileScale: 0.5,
    maskFeatherPx: 2.0,
    lightStrength: 0.72,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: W('large-bathroom-b', 'mask-floor') },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: W('large-bathroom-b', 'mask-wall') },
    ],
  },
  // Model C — Staircase (full stair surfaces only — walls stay photo-locked)
  {
    id: 'staircase-c',
    name: 'Staircase',
    blurb: 'PRD Model C · full stairs only',
    baseUrl: W('staircase-c', 'base'),
    overlayUrl: W('staircase-c', 'overlay-locked'),
    roomWidthMM: 4200,
    defaultTileScale: 0.55,
    maskFeatherPx: 2.4,
    lightStrength: 0.88,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Stairs', surface: 'Floor', maskUrl: W('staircase-c', 'mask-floor') },
    ],
  },
  // Model D — Feature Wall (wall only — no floor zone)
  {
    id: 'feature-wall-d',
    name: 'Feature Wall',
    blurb: 'PRD Model D · wall only',
    baseUrl: W('feature-wall-d', 'base'),
    overlayUrl: W('feature-wall-d', 'overlay-locked'),
    roomWidthMM: 9144,
    defaultTileScale: 0.55,
    maskFeatherPx: 2.0,
    lightStrength: 0.68,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: W('feature-wall-d', 'mask-wall') },
    ],
  },
  // Model E — Vanity
  {
    id: 'vanity-e',
    name: 'Vanity Counter',
    blurb: 'PRD Model E · floor + wall',
    baseUrl: W('vanity-e', 'base'),
    overlayUrl: W('vanity-e', 'overlay-locked'),
    roomWidthMM: 3600,
    defaultTileScale: 0.55,
    maskFeatherPx: 2.0,
    lightStrength: 0.72,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: W('vanity-e', 'mask-floor') },
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: W('vanity-e', 'mask-wall') },
    ],
  },
]

export const getRoom2d = (id) => rooms2d.find((r) => r.id === id) || rooms2d[0]

/** All image URLs for a room pack (for preload). */
export function roomAssetUrls(room) {
  if (!room) return []
  const urls = [room.baseUrl, room.overlayUrl].filter(Boolean)
  for (const z of room.zones || []) {
    if (z.maskUrl) urls.push(z.maskUrl)
  }
  return urls
}

/** Prefetch room pack images into browser HTTP cache. */
export function preloadRoomAssets(room) {
  if (typeof window === 'undefined' || !room) return
  for (const url of roomAssetUrls(room)) {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
