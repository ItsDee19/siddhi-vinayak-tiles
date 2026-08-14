#!/usr/bin/env node
// =============================================================================
// build_room_asset_versions.mjs
//
// Writes src/data/roomAssetVersions.json — a content hash per 2D room asset,
// which rooms2d.js appends to each URL as ?v=<hash>.
//
// Why this is needed: the room packs live in public/, which Vite copies to the
// output verbatim WITHOUT fingerprinting. So /2d-rooms/vanity-e/base.webp is a
// permanent URL, and replacing the image behind it leaves every browser that
// already has a copy showing the old room. That is exactly what happened when
// the vanity pack was rebuilt — the deploy was correct and the bytes on the CDN
// were right, but visitors kept seeing the previous vanity.
//
// The response headers are already correct (max-age=0, must-revalidate), so a
// well-behaved browser revalidates. This closes the gap for everything else:
// intermediate proxies, aggressive mobile caches, and any browser holding a
// copy from before the deploy. A changed file gets a changed URL, which cannot
// be served from a stale cache entry.
//
// Hashes are PER FILE, not one version for the whole set, so rebuilding one
// room does not force every visitor to re-download the other four (several MB
// of photography).
//
// Runs automatically before `npm run build` — see package.json — so the
// manifest cannot drift from the assets it describes.
//
// Run:  node scripts/build_room_asset_versions.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOMS_DIR = path.join(ROOT, 'public/2d-rooms')
const OUT = path.join(ROOT, 'src/data/roomAssetVersions.json')

function main() {
  if (!fs.existsSync(ROOMS_DIR)) {
    console.error(`Missing ${ROOMS_DIR}`)
    process.exit(1)
  }

  const versions = {}
  // Only the room directories the app actually reads — ignore the pipeline
  // scratch folders (_generated-bases, etc.) that start with an underscore.
  const rooms = fs
    .readdirSync(ROOMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)

  for (const room of rooms) {
    for (const file of fs.readdirSync(path.join(ROOMS_DIR, room))) {
      // rooms2d.js only ever requests .webp; the .png originals stay for tooling.
      if (!file.endsWith('.webp')) continue
      const buf = fs.readFileSync(path.join(ROOMS_DIR, room, file))
      const key = `${room}/${file.replace(/\.webp$/, '')}`
      versions[key] = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)
    }
  }

  const sorted = Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)))
  const next = JSON.stringify(sorted, null, 2) + '\n'
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''

  if (prev === next) {
    console.log(`room asset versions unchanged (${Object.keys(sorted).length} assets)`)
    return
  }

  fs.writeFileSync(OUT, next)
  console.log(`wrote ${OUT} — ${Object.keys(sorted).length} assets across ${rooms.length} rooms`)
}

main()
