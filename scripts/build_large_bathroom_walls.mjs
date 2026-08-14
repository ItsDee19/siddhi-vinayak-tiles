#!/usr/bin/env node
// =============================================================================
// build_large_bathroom_walls.mjs
//
// Splits the Large Bathroom's wall mask into three connected horizontal bands
// at 30% / 40% / 30%, so each can take its own tile.
//
// WHY THE BANDS ARE CUT PER COLUMN, NOT PER ROW
// The room is shot in perspective: the left (vanity) wall recedes toward the
// corner while the back wall faces the camera. A line of constant height in the
// room is therefore a SLOPING line in the photograph, and cutting the mask at
// flat image rows would make the bands visibly step where the two walls meet.
//
// Each column of the mask is instead split across its own vertical extent. On
// the frontal wall that produces level bands; on the receding wall it follows
// the perspective automatically; and because both walls live in one mask, the
// bands run straight across the corner without a seam. That is what "connected
// across both walls" requires.
//
// WHAT IT WRITES
// The three band masks, and a matching hole in overlay-locked. That hole is
// not optional: the overlay is the photograph with cut-outs where tile shows,
// drawn last, so widening the mask without opening the overlay changes nothing
// on screen. base.png is left untouched.
//
// WHAT IT DELIBERATELY DOES NOT DO
// It does not remove the shower enclosure or the tub. Those are image-editing
// jobs — the glass is transparent, so tiling over it drags the frame, hinges
// and reflections through the tile, and the tub sits partly over the floor.
// The pack's own tooling (SAM segmentation plus Photopea refinement, see
// sam_meta.json) is what produced these plates; hand-traced polygons tried here
// leaked tiles onto the floor and ceiling. The band split works on whatever
// wall surface the mask describes, so re-authoring the plate later needs no
// change to this script: regenerate mask-wall and re-run.
//
// Run:  node scripts/build_large_bathroom_walls.mjs
//       PREVIEW=1 node scripts/build_large_bathroom_walls.mjs   (writes no pack files)
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/2d-rooms/large-bathroom-b')
const SRC = path.join(DIR, 'mask-wall.png')
const OVERLAY = path.join(DIR, 'overlay-locked.png')

// Top → bottom, as fractions of each column's wall extent. Must sum to 1.
const BANDS = [
  { id: 'wall-upper', label: 'Upper', fraction: 0.30 },
  { id: 'wall-middle', label: 'Middle', fraction: 0.40 },
  { id: 'wall-lower', label: 'Lower', fraction: 0.30 },
]

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`)
    process.exit(1)
  }
  const total = BANDS.reduce((a, b) => a + b.fraction, 0)
  if (Math.abs(total - 1) > 1e-6) {
    console.error(`Bands must sum to 1, got ${total}`)
    process.exit(1)
  }

  const raw = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = raw.info
  const data = Buffer.from(raw.data)

  // The supplied mask stops at the shower (x≈0.44), leaving the whole far wall
  // untileable even though it is clean, unobstructed surface in the photo.
  // That section is frontal and rectangular, so it can be added as a quad
  // without any of the tracing risk the receding wall carries. The corner
  // coordinates below are MEASURED, not eyeballed: the ceiling and floor
  // junctions were found by locating the strongest vertical luminance step in
  // each column (ceiling 0.070→0.022 and floor 0.684→0.723 between x=0.74 and
  // x=0.90, all with step magnitudes of 36-139, i.e. real architectural edges).
  //
  // The shower enclosure itself is deliberately left out. Its glass is
  // transparent, so tiling over it would drag the frame, hinges and reflections
  // through the tile as ghosting — that needs the plate repainting, not a mask.
  const FAR_WALL = [
    [0.720, 0.074], [0.930, 0.014], [0.930, 0.730], [0.720, 0.678],
  ]
  // Planter and foliage stand in front of the far wall and must keep occluding it.
  const FAR_WALL_HOLES = [
    [[0.792, 0.262], [0.952, 0.262], [0.952, 0.720], [0.792, 0.720]],
  ]

  const fill = (poly) => {
    const pts = poly.map(([fx, fy]) => [fx * W, fy * H])
    const m = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      const xs = []
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]
        const [x2, y2] = pts[(i + 1) % pts.length]
        if (y1 === y2) continue
        if (y >= Math.min(y1, y2) && y < Math.max(y1, y2)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) m[y * W + x] = 255
      }
    }
    return m
  }

  // Two surfaces are tracked, and the difference matters.
  //
  //   envelope — the wall PLANE, fixtures included. Band boundaries are
  //              measured against this.
  //   surface  — where tile is actually painted, fixtures cut out.
  //
  // Splitting against the holed surface was wrong: a column passing through
  // the planter has its lowest masked pixel somewhere up at the leaves, so the
  // whole 30/40/30 split compressed into the top of that column and the bands
  // visibly stepped around the plant. Measuring against the uncut plane keeps
  // every band at a constant height whether a fixture stands in front of it or
  // not.
  const farPlane = fill(FAR_WALL)
  const far = Uint8Array.from(farPlane)
  for (const hole of FAR_WALL_HOLES) {
    const h = fill(hole)
    for (let i = 0; i < far.length; i++) if (h[i]) far[i] = 0
  }

  const envelope = new Uint8Array(W * H)
  let added = 0
  for (let i = 0; i < W * H; i++) {
    if (data[i] > 127 || farPlane[i]) envelope[i] = 255
    if (far[i] && data[i] <= 127) { data[i] = 255; added++ }
  }

  const wallPx = data.reduce((a, v) => a + (v > 127 ? 1 : 0), 0)
  console.log(`mask ${W}x${H} — wall surface ${wallPx} px (far wall added ${added} px)`)

  const out = BANDS.map(() => new Uint8Array(W * H))
  let columns = 0

  for (let x = 0; x < W; x++) {
    // Extent comes from the uncut wall plane, so fixtures standing in front of
    // the wall cannot shift a band's height.
    let top = -1
    let bottom = -1
    for (let y = 0; y < H; y++) {
      if (envelope[y * W + x]) { if (top < 0) top = y; bottom = y }
    }
    if (top < 0) continue
    columns++

    const extent = bottom - top + 1
    // Cumulative cut positions down the column.
    const cuts = []
    let acc = 0
    for (const b of BANDS) { acc += b.fraction; cuts.push(top + extent * acc) }

    for (let y = top; y <= bottom; y++) {
      if (data[y * W + x] <= 127) continue
      let bi = BANDS.length - 1
      for (let k = 0; k < cuts.length; k++) { if (y < cuts[k]) { bi = k; break } }
      out[bi][y * W + x] = 255
    }
  }
  console.log(`split across ${columns} wall columns`)

  // Integrity: the bands must partition the mask exactly.
  let overlap = 0
  let covered = 0
  for (let i = 0; i < W * H; i++) {
    const hits = (out[0][i] ? 1 : 0) + (out[1][i] ? 1 : 0) + (out[2][i] ? 1 : 0)
    if (hits > 1) overlap++
    if (hits > 0) covered++
  }
  console.log(`partition check — covered ${covered}/${wallPx}, overlap ${overlap}`)
  if (overlap !== 0 || covered !== wallPx) {
    console.error('Bands do not partition the wall exactly — refusing to write.')
    process.exit(1)
  }

  // The overlay is the photograph with holes cut where tile shows, drawn last.
  // Widening the mask alone changes nothing visible — the overlay simply
  // repaints the original wall over the new tile. Measured directly: alpha was
  // 255 across the whole far wall while the old masked region read 0. So the
  // matching hole has to be cut here, or the far wall silently does nothing.
  if (!process.env.PREVIEW && added > 0) {
    const ov = await sharp(OVERLAY).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const oData = Buffer.from(ov.data)
    let cleared = 0
    for (let i = 0; i < W * H; i++) {
      // Only where tile is actually painted — never under a fixture.
      if (far[i] && oData[i * 4 + 3] !== 0) { oData[i * 4 + 3] = 0; cleared++ }
    }
    await sharp(oData, { raw: { width: W, height: H, channels: 4 } })
      .png().toFile(OVERLAY)
    await sharp(oData, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 82, alphaQuality: 100 }).toFile(path.join(DIR, 'overlay-locked.webp'))
    console.log(`overlay: opened ${cleared} px over the far wall`)
  }

  if (process.env.PREVIEW) {
    const base = await sharp(path.join(DIR, 'base.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const px = Buffer.from(base.data)
    const tints = [[255, 90, 90], [90, 210, 130], [100, 160, 255]]
    for (let i = 0; i < W * H; i++) {
      for (let b = 0; b < 3; b++) {
        if (!out[b][i]) continue
        for (let c = 0; c < 3; c++) px[i * 3 + c] = Math.round(px[i * 3 + c] * 0.45 + tints[b][c] * 0.55)
      }
    }
    const outFile = path.join(ROOT, 'build-artifacts/large-bathroom-bands.png')
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    await sharp(px, { raw: { width: W, height: H, channels: 3 } }).resize(960).png().toFile(outFile)
    console.log(`PREVIEW → ${outFile}  (red=upper, green=middle, blue=lower)`)
    return
  }

  for (let i = 0; i < BANDS.length; i++) {
    const rgb = await sharp(Buffer.from(out[i]), { raw: { width: W, height: H, channels: 1 } })
      .toColourspace('srgb').png().toBuffer()
    await sharp(rgb).png().toFile(path.join(DIR, `mask-${BANDS[i].id}.png`))
    await sharp(rgb).webp({ quality: 90 }).toFile(path.join(DIR, `mask-${BANDS[i].id}.webp`))
    const px = out[i].reduce((a, v) => a + (v ? 1 : 0), 0)
    console.log(`  ${BANDS[i].id.padEnd(12)} ${px} px (${(100 * px / wallPx).toFixed(1)}% of wall)`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
