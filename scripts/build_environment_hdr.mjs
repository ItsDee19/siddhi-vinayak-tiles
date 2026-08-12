#!/usr/bin/env node
// =============================================================================
// build_environment_hdr.mjs
//
// Generates public/hdri/showroom.hdr — an equirectangular, high-dynamic-range
// environment for the 3D visualizer's image-based lighting.
//
// Why generate rather than ship a captured HDRI: a photographed environment
// would be better light, but it puts a third-party binary asset and its licence
// into the repo. This is authored here instead, so provenance is not a
// question and the content can be tuned to the product — a tile showroom,
// which wants a big window bank to reflect and warm bounce off a tiled floor.
//
// What this buys over the four <Lightformer> rectangles it supersedes:
//
//   * REAL dynamic range. The Lightformers topped out at intensity 2.6. Sun
//     through glass is orders of magnitude brighter than a wall, and that ratio
//     is what makes a specular highlight read as light rather than as pale
//     paint. The window here sits at ~40, the softboxes ~8, the walls <1.
//   * STRUCTURE. A polished tile reflects its surroundings. Reflecting four
//     featureless rectangles looks like nothing in particular; reflecting a
//     mullioned window bank looks like a room. The mullions are the single
//     most recognisable thing in the image.
//   * Gradients rather than flat panels, so reflections fall off across a
//     surface instead of banding.
//
// Encoded as Radiance RGBE with new-style per-scanline RLE, which is what
// three's RGBELoader expects and what drei's <Environment files=...> uses.
//
// Run:  node scripts/build_environment_hdr.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public/hdri')
const OUT_FILE = path.join(OUT_DIR, 'showroom.hdr')

// 1024x512 is comfortably above the 256px cube drei renders it into, leaving
// headroom for the sharper reflections a polished finish shows.
const W = 1024
const H = 512

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
// A soft-edged band, 1 inside [a,b] and falling off over `f` on each side.
const band = (x, a, b, f) => smooth(a - f, a + f, x) * (1 - smooth(b - f, b + f, x))

// ---------------------------------------------------------------------------
// The environment itself, sampled per direction.
//
// theta: 0 at the zenith, PI at nadir.  phi: 0..2PI around.
// Returns linear RGB, unbounded above 1.
// ---------------------------------------------------------------------------
function sample(theta, phi) {
  const up = Math.cos(theta) // +1 zenith, -1 nadir
  let r = 0, g = 0, b = 0

  const add = (i, cr, cg, cb) => { r += i * cr; g += i * cg; b += i * cb }

  // --- Ambient shell: warm near the ceiling, cooling and darkening downward.
  const ceilMix = smooth(-0.15, 0.9, up)
  add(0.16 + 0.42 * ceilMix, 1.0, 0.96, 0.90)
  // Cool fill on the side opposite the window, so the two halves of the room
  // are not the same colour — that difference is what gives a curved or
  // glossy surface its sense of orientation.
  add(0.10 * smooth(-0.4, 0.6, Math.cos(phi - Math.PI)), 0.72, 0.82, 1.0)

  // --- Ceiling softboxes: two long panels either side of centre.
  const ceil = smooth(0.55, 0.95, up)
  const panelA = band(Math.cos(phi - Math.PI * 0.5), 0.35, 1.0, 0.30)
  const panelB = band(Math.cos(phi - Math.PI * 1.5), 0.35, 1.0, 0.30)
  add(8.0 * ceil * (panelA + panelB), 1.0, 0.97, 0.92)

  // --- Window bank on one wall, roughly horizon height.
  //     Bright, cool daylight — the dominant source and the main thing any
  //     glossy tile will show.
  const winV = band(up, -0.28, 0.34, 0.05)                 // vertical extent
  const winH = band(Math.cos(phi), 0.42, 1.0, 0.10)        // horizontal extent
  let window = winV * winH

  if (window > 0) {
    // Mullions: dark bars subdividing the glazing. Frequencies are chosen so
    // roughly four panes are visible across the bank, which reads as a window
    // rather than as stripes.
    const vBar = 1 - 0.92 * Math.pow(Math.abs(Math.sin(phi * 9.0)), 24)
    const hBar = 1 - 0.92 * Math.pow(Math.abs(Math.sin((up + 0.28) * Math.PI * 3.2)), 24)
    // Sky is brighter toward the top of the opening.
    const skyGrad = 0.55 + 0.45 * smooth(-0.28, 0.34, up)
    add(40.0 * window * vBar * hBar * skyGrad, 0.88, 0.94, 1.0)
  }

  // --- Floor bounce: warm, broad, low. A tiled floor throws a lot of light
  //     back up, and without it everything below the horizon goes dead.
  const floor = smooth(0.1, -0.85, up)
  add(0.30 * floor, 0.85, 0.66, 0.48)

  // Never return exactly zero: a pure-black environment sample produces
  // NaN-prone reflections on very smooth materials.
  return [Math.max(r, 0.002), Math.max(g, 0.002), Math.max(b, 0.002)]
}

// ---------------------------------------------------------------------------
// Radiance RGBE encoding.
// ---------------------------------------------------------------------------
function toRGBE(r, g, b) {
  const max = Math.max(r, g, b)
  if (max < 1e-32) return [0, 0, 0, 0]
  const e = Math.ceil(Math.log2(max))
  const f = Math.pow(2, -e) * 256
  return [
    Math.min(255, Math.floor(r * f)),
    Math.min(255, Math.floor(g * f)),
    Math.min(255, Math.floor(b * f)),
    Math.min(255, e + 128),
  ]
}

// New-style RLE: each scanline stores its four components separately, each
// encoded as alternating run and literal packets. Runs are marked by a count
// byte > 128. This is what keeps a smooth gradient image small.
function encodeScanlineRLE(components, width) {
  const out = []
  for (let c = 0; c < 4; c++) {
    const line = components[c]
    let x = 0
    while (x < width) {
      // Find a run of >= 4 identical bytes starting at or after x.
      let runStart = x
      let runLen = 0
      while (runStart < width) {
        runLen = 1
        while (runStart + runLen < width && runLen < 127 && line[runStart + runLen] === line[runStart]) runLen++
        if (runLen >= 4) break
        runStart += runLen
      }
      // Everything before the run is emitted as literal packets.
      while (x < runStart) {
        const n = Math.min(128, runStart - x)
        out.push(n)
        for (let i = 0; i < n; i++) out.push(line[x + i])
        x += n
      }
      if (runStart < width && runLen >= 4) {
        out.push(128 + runLen)
        out.push(line[runStart])
        x = runStart + runLen
      }
    }
  }
  return out
}

function main() {
  const header = Buffer.from(
    '#?RADIANCE\n' +
    '# Generated by scripts/build_environment_hdr.mjs\n' +
    'FORMAT=32-bit_rle_rgbe\n' +
    '\n' +
    `-Y ${H} +X ${W}\n`,
    'ascii',
  )

  const chunks = [header]
  const comps = [new Uint8Array(W), new Uint8Array(W), new Uint8Array(W), new Uint8Array(W)]

  for (let y = 0; y < H; y++) {
    // +0.5 samples pixel centres, so the poles are not sampled exactly at the
    // singularity.
    const theta = ((y + 0.5) / H) * Math.PI
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2
      const [r, g, b] = sample(theta, phi)
      const [R, G, B, E] = toRGBE(r, g, b)
      comps[0][x] = R; comps[1][x] = G; comps[2][x] = B; comps[3][x] = E
    }
    // Scanline header for new-style RLE: 2,2,<hi>,<lo>
    chunks.push(Buffer.from([2, 2, (W >> 8) & 0xff, W & 0xff]))
    chunks.push(Buffer.from(encodeScanlineRLE(comps, W)))
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const buf = Buffer.concat(chunks)
  fs.writeFileSync(OUT_FILE, buf)

  console.log(`wrote ${OUT_FILE}`)
  console.log(`  ${W}x${H}  ${(buf.length / 1024).toFixed(0)} KB  (flat RGBE would be ${((W * H * 4) / 1024).toFixed(0)} KB)`)
}

main()
