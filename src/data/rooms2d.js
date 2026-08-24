// 2D lifestyle room packs — photo + masks + locked overlay.
// Prefer WebP when present (built by scripts/build_2d_room_webp.mjs); PNG remains for tools.

import roomAssetVersions from './roomAssetVersions.json'

// These assets live in public/, so Vite copies them out verbatim and never
// fingerprints them — /2d-rooms/vanity-e/base.webp is a permanent URL. Swapping
// the image behind it leaves anyone holding a cached copy looking at the old
// room, which is precisely what happened when the vanity pack was rebuilt: the
// deploy was correct and the CDN had the right bytes, but browsers kept
// painting the previous vanity.
//
// Appending a content hash gives each revision its own URL, so a stale entry
// can never satisfy the request. Hashes are per file (see
// scripts/build_room_asset_versions.mjs, which runs before every build), so
// rebuilding one room does not invalidate the other four.
const W = (room, file) => {
  const version = roomAssetVersions[`${room}/${file}`]
  return `/2d-rooms/${room}/${file}.webp${version ? `?v=${version}` : ''}`
}

export const rooms2d = [
  // Model A — Small Bathroom (Photopea-quality pack)
  //
  // Wall is three straight horizontal bands (PRD §4.2 3-2-3): lower, a thin
  // accent strip, then upper. Floor is also tileable. Tiling is computed
  // across the whole plate and then masked per zone, so panels given the same
  // tile still line up across the seams.
  {
    id: 'bathroom-01',
    name: 'Small Bathroom',
    blurb: 'PRD Model A · floor + 3-2-3 wall bands',
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
      { id: 'lower', label: 'Lower Wall', surface: 'Wall', maskUrl: W('bathroom-01', 'mask-wall-lower') },
      { id: 'feature', label: 'Accent Strip', surface: 'Wall', maskUrl: W('bathroom-01', 'mask-wall-feature') },
      { id: 'upper', label: 'Upper Wall', surface: 'Wall', maskUrl: W('bathroom-01', 'mask-wall-upper') },
    ],
  },
  // Model B — Large Bathroom
  //
  // Frontal pack (no mirror): floor plus three straight horizontal wall bands
  // (PRD §4.3 2-4-2) — lower, feature, upper. Fixtures stay in overlay-locked.
  {
    id: 'large-bathroom-b',
    name: 'Large Bathroom',
    blurb: 'PRD Model B · floor + 2-4-2 wall bands',
    baseUrl: W('large-bathroom-b', 'base'),
    overlayUrl: W('large-bathroom-b', 'overlay-locked'),
    roomWidthMM: 4000,
    defaultTileScale: 0.5,
    maskFeatherPx: 2.0,
    lightStrength: 0.72,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: W('large-bathroom-b', 'mask-floor') },
      { id: 'lower', label: 'Lower Band', surface: 'Wall', maskUrl: W('large-bathroom-b', 'mask-wall-lower') },
      { id: 'feature', label: 'Feature Band', surface: 'Wall', maskUrl: W('large-bathroom-b', 'mask-wall-feature') },
      { id: 'upper', label: 'Upper Band', surface: 'Wall', maskUrl: W('large-bathroom-b', 'mask-wall-upper') },
    ],
  },
  // Model C — Staircase (full stair surfaces only — walls stay photo-locked)
  {
    id: 'staircase-c',
    name: 'Staircase',
    blurb: 'PRD Model C · upper+lower treads, sides locked',
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
  // Model E — Vanity (wall + floor + basin/granite hero slab)
  {
    id: 'vanity-e',
    name: 'Vanity Counter',
    blurb: 'PRD Model E · wall + floor + basin',
    baseUrl: W('vanity-e', 'base'),
    overlayUrl: W('vanity-e', 'overlay-locked'),
    roomWidthMM: 3600,
    defaultTileScale: 0.55,
    maskFeatherPx: 2.0,
    lightStrength: 0.72,
    grout: { enabled: false, color: '#d4cdc0' },
    zones: [
      { id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: W('vanity-e', 'mask-wall') },
      { id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: W('vanity-e', 'mask-floor') },
      // Basin chip covers the wash basin + the granite counter as one hero surface.
      // Tap, wood drawers and watermark stay locked in the overlay.
      { id: 'basin', label: 'Basin', surface: 'Both', maskUrl: W('vanity-e', 'mask-basin') },
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
