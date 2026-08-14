#!/usr/bin/env node
// =============================================================================
// build_bathroom01_wall_partitions.mjs
//
// Splits the Small Bathroom's single wall mask into three vertical partitions
// at 30% / 40% / 30%, so each can take its own tile.
//
// The cuts are measured against the WALL, not the image. The wall occupies
// x∈[309, 3051] of a 3344px-wide plate — roughly 82% of the frame, offset left
// of centre — so splitting the image into thirds would put the seams in the
// wrong places and give the left partition a strip of off-wall pixels. The
// span is found by column occupancy rather than a raw bounding box, so a few
// stray anti-aliased pixels at the extreme edges cannot drag the measurement
// outward.
//
// Each output keeps the original mask's cut-outs (mirror, vanity, toilet,
// flush plate) and simply blacks out everything outside its own band, so the
// three partitions reassemble to exactly the original wall with no overlap and
// no gap. The seams are hard-edged on purpose: composeRoom feathers mask edges
// by room.maskFeatherPx when it builds the layer, and pre-feathering here would
// double up and leave a translucent seam where two partitions meet.
//
// Writes .webp (what rooms2d.js requests) and .png (kept for tooling, matching
// the rest of the pack).
//
// Run:  node scripts/build_bathroom01_wall_partitions.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/2d-rooms/bathroom-01')
const SRC = path.join(DIR, 'mask-wall.png')

// Left → right. Must sum to 1.
const SPLITS = [
  { id: 'wall-left', fraction: 0.30 },
  { id: 'wall-center', fraction: 0.40 },
  { id: 'wall-right', fraction: 0.30 },
]

async function wallSpan(greyData, W, H) {
  const col = new Int32Array(W)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (greyData[y * W + x] > 127) col[x]++
    }
  }
  const peak = Math.max(...col)
  const cutoff = peak * 0.05
  let x0 = 0
  let x1 = W - 1
  while (x0 < W && col[x0] < cutoff) x0++
  while (x1 > 0 && col[x1] < cutoff) x1--
  return { x0, x1 }
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`)
    process.exit(1)
  }

  const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const { x0, x1 } = await wallSpan(data, W, H)
  const span = x1 - x0 + 1
  console.log(`wall mask ${W}x${H} — wall spans x:[${x0}, ${x1}] (${span}px)`)

  const total = SPLITS.reduce((a, s) => a + s.fraction, 0)
  if (Math.abs(total - 1) > 1e-6) {
    console.error(`Splits must sum to 1, got ${total}`)
    process.exit(1)
  }

  // Only the cuts BETWEEN partitions are placed by the 30/40/30 measurement.
  // The outer edges run to the image border rather than to the measured wall
  // span: the span is deliberately robust against stray anti-aliased columns,
  // and those few pixels would otherwise fall outside every band and be lost
  // from the wall entirely. Extending outward costs nothing, because the source
  // mask is already black everywhere off the wall.
  let cursor = 0
  for (let i = 0; i < SPLITS.length; i++) {
    const { id } = SPLITS[i]
    const isLast = i === SPLITS.length - 1
    const cumulative = SPLITS.slice(0, i + 1).reduce((a, s) => a + s.fraction, 0)
    const start = cursor
    const end = isLast ? W - 1 : Math.round(x0 + span * cumulative) - 1
    cursor = end + 1

    // Black outside the band, original mask inside it.
    const band = Buffer.alloc(W * H)
    for (let y = 0; y < H; y++) {
      const row = y * W
      for (let x = start; x <= end; x++) band[row + x] = data[row + x]
    }

    const grey = sharp(band, { raw: { width: W, height: H, channels: 1 } })
    const rgb = await grey.clone().toColourspace('srgb').png().toBuffer()
    await sharp(rgb).png().toFile(path.join(DIR, `mask-${id}.png`))
    await sharp(rgb).webp({ quality: 90 }).toFile(path.join(DIR, `mask-${id}.webp`))

    const white = band.reduce((a, v) => a + (v > 127 ? 1 : 0), 0)
    console.log(
      `  ${id.padEnd(12)} x:[${start}, ${end}] — ${white} white px`,
    )
  }

  console.log('\nRemember: rooms2d.js must list these as zones, and')
  console.log('scripts/build_room_asset_versions.mjs must run to pick up the new files.')
}

main().catch((e) => { console.error(e); process.exit(1) })
