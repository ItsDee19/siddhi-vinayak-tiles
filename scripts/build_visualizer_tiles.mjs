#!/usr/bin/env node
// =============================================================================
// build_visualizer_tiles.mjs
//
// Fixes the long-standing "horizontal lines on 3D walls" bug at its actual
// root cause: the catalogue swatches under public/assets/catalogue/
// clean_swatches/ are correctly-cropped single tile *photos*, but many still
// carry a thin baked-in border frame (light margin / packaging edge) left
// over from the PDF-page extraction. When RepeatWrapping tiles these across
// a wall, that border repeats as a visible grid of light lines.
//
// This script does NOT touch clean_swatches/ or importedCatalogue.js — the
// bottom product catalogue grid must stay byte-for-byte untouched. It reads
// only the images the 3D visualizer actually references, and writes a NEW,
// separate directory:
//
//   public/assets/catalogue/visualizer_tiles/
//     <name>@2048.webp   — desktop variant
//     <name>@1024.webp   — mobile variant
//     manifest.json       — name -> { desktop, mobile, width, height, status }
//     _contactsheet.webp  — grid of every processed tile, for a one-look QA pass
//     _quarantine/        — inputs whose auto-crop failed validation (original copied through)
//
// Pipeline per image:
//   1. Detect a per-image border frame (not a per-family constant — measured
//      border widths vary widely even within one family) by walking in from
//      each edge while that row/column is both low-variance and offset in
//      mean luminance from the image core. Capped at 30% per side; if a
//      single side's detected trim would exceed 15%, that side falls back to
//      a conservative fixed 2% trim instead (guards against the detector
//      misfiring on a genuinely busy tile, e.g. dark granite with light veins
//      near an edge).
//   2. Resize into the nearest power-of-two bucket, preserving aspect ratio.
//   3. Make it wrap-seamless via the classic "offset by half + heal the new
//      center cross-seam with a blurred, masked composite" technique. This
//      moves the discontinuity from the tile's outer edges (where it always
//      repeats visibly) to the middle, then blends it away — no seam left
//      anywhere the eye can pick up a repeat.
//   4. Validate: measure the residual edge discontinuity on the final image.
//      Anything above threshold is quarantined (excluded from the manifest,
//      copied to _quarantine/ for manual attention) rather than shipped.
//
// Run:  node scripts/build_visualizer_tiles.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/assets/catalogue/clean_swatches')
const OUT_DIR = path.join(ROOT, 'public/assets/catalogue/visualizer_tiles')
const QUARANTINE_DIR = path.join(OUT_DIR, '_quarantine')
// The manifest must live under src/ so Vite can bundle it as a static JSON
// import (threeTextures.js imports it directly — no runtime fetch).
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualizerTileManifest.json')
const DATA_FILES = [
  path.join(ROOT, 'src/data/importedCatalogue.js'),
  path.join(ROOT, 'src/data/visualizerCatalogue.js'),
]

const DESKTOP_MAX = 2048
const MOBILE_MAX = 1024
const WEBP_QUALITY = 82

// ---------------------------------------------------------------------------
// 1. Discover every textureUrl the visualizer actually references.
//    (Only these need processing — not all 1375 files in clean_swatches/,
//    most of which are catalogue-grid-only images.)
// ---------------------------------------------------------------------------
function collectReferencedFiles() {
  const names = new Set()
  // Matches both the current /clean_swatches/ path and the legacy
  // /swatches/ path (resolveZoneSource() rewrites the latter to the former
  // at runtime — see threeTextures.js). Either way the file lives in
  // clean_swatches/ on disk, so only the basename matters here.
  const re = /"textureUrl":\s*"([^"]*\/(?:clean_)?swatches\/[^"]+)"|textureUrl:\s*'([^']*\/(?:clean_)?swatches\/[^']+)'/g
  for (const file of DATA_FILES) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    let m
    while ((m = re.exec(text))) {
      const url = m[1] || m[2]
      names.add(path.basename(url))
    }
  }
  return [...names].sort()
}

// ---------------------------------------------------------------------------
// 2. Per-image border detection.
// ---------------------------------------------------------------------------
async function detectBorders(inputPath) {
  const { data, info } = await sharp(inputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const lum = (x, y) => {
    const i = (y * W + x) * C
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const strideX = Math.max(1, W >> 6)
  const strideY = Math.max(1, H >> 6)
  const rowStat = (y) => {
    let s = 0, s2 = 0, n = 0
    for (let x = 0; x < W; x += strideX) { const L = lum(x, y); s += L; s2 += L * L; n++ }
    const m = s / n
    return { m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) }
  }
  const colStat = (x) => {
    let s = 0, s2 = 0, n = 0
    for (let y = 0; y < H; y += strideY) { const L = lum(x, y); s += L; s2 += L * L; n++ }
    const m = s / n
    return { m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) }
  }
  const core = rowStat(H >> 1)
  const isBorderRow = (y) => { const r = rowStat(y); return r.sd < 8 && Math.abs(r.m - core.m) > 28 }
  const isBorderCol = (x) => { const c = colStat(x); return c.sd < 8 && Math.abs(c.m - core.m) > 28 }

  let T = 0, B = 0, L = 0, R = 0
  const capY = Math.floor(H * 0.3)
  const capX = Math.floor(W * 0.3)
  while (T < capY && isBorderRow(T)) T++
  while (B < capY && isBorderRow(H - 1 - B)) B++
  while (L < capX && isBorderCol(L)) L++
  while (R < capX && isBorderCol(W - 1 - R)) R++

  // Fallback: a detector misfire on a busy/high-contrast tile can walk too
  // far in. Cap each side individually rather than discarding the whole
  // detection, since the other three sides may be perfectly legitimate.
  const FALLBACK_FRAC = 0.02
  if (T > H * 0.15) T = Math.round(H * FALLBACK_FRAC)
  if (B > H * 0.15) B = Math.round(H * FALLBACK_FRAC)
  if (L > W * 0.15) L = Math.round(W * FALLBACK_FRAC)
  if (R > W * 0.15) R = Math.round(W * FALLBACK_FRAC)

  return { W, H, T, B, L, R }
}

// ---------------------------------------------------------------------------
// 3. Nearest power-of-two bucket, preserving aspect ratio.
// ---------------------------------------------------------------------------
function nearestPOT(n) {
  return Math.pow(2, Math.round(Math.log2(n)))
}
function potDims(w, h, maxSide) {
  const aspect = w / h
  let outW, outH
  if (aspect >= 1) {
    outW = Math.min(maxSide, nearestPOT(w))
    outH = nearestPOT(outW / aspect)
  } else {
    outH = Math.min(maxSide, nearestPOT(h))
    outW = nearestPOT(outH * aspect)
  }
  outW = Math.max(64, Math.min(maxSide, outW))
  outH = Math.max(64, Math.min(maxSide, outH))
  return { outW, outH }
}

// ---------------------------------------------------------------------------
// 4. Seamless tiling via offset-by-half + heal the new center cross-seam.
//    Standard texture-authoring trick: swapping quadrants diagonally moves
//    the original (already-continuous) center of the photo out to the tile's
//    edges, and moves the ORIGINAL edges (where a repeat would show a seam)
//    into the middle, where we blur+mask-blend them away. We do NOT swap
//    back — the phase shift is invisible once the texture repeats.
// ---------------------------------------------------------------------------
async function makeSeamless(buffer, W, H) {
  const W2 = Math.floor(W / 2)
  const H2 = Math.floor(H / 2)

  const img = sharp(buffer)
  const [tl, tr, bl, br] = await Promise.all([
    sharp(buffer).extract({ left: 0, top: 0, width: W - W2, height: H - H2 }).toBuffer(),
    sharp(buffer).extract({ left: W - W2, top: 0, width: W2, height: H - H2 }).toBuffer(),
    sharp(buffer).extract({ left: 0, top: H - H2, width: W - W2, height: H2 }).toBuffer(),
    sharp(buffer).extract({ left: W - W2, top: H - H2, width: W2, height: H2 }).toBuffer(),
  ])

  const offset = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: br, left: 0, top: 0 },
      { input: bl, left: W - W2, top: 0 },
      { input: tr, left: 0, top: H - H2 },
      { input: tl, left: W - W2, top: H - H2 },
    ])
    .png()
    .toBuffer()

  // Blur a copy for the seam band.
  const bandPx = Math.max(12, Math.min(64, Math.round(Math.min(W, H) * 0.06)))
  const blurred = await sharp(offset).blur(bandPx * 0.6).raw().toBuffer({ resolveWithObject: true })

  // Cross-shaped alpha mask: opaque near x=W2 (vertical seam) and y=H2
  // (horizontal seam), fading out over bandPx, zero elsewhere.
  const mask = Buffer.alloc(W * H)
  const bandFn = (d) => Math.max(0, 1 - d / bandPx)
  for (let y = 0; y < H; y++) {
    const vAlpha = bandFn(Math.abs(y - H2))
    for (let x = 0; x < W; x++) {
      const hAlpha = bandFn(Math.abs(x - W2))
      const a = Math.max(vAlpha, hAlpha)
      mask[y * W + x] = Math.round(a * 255)
    }
  }

  const rgba = Buffer.alloc(W * H * 4)
  const rgb = blurred.data
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    rgba[p] = rgb[i * 3]
    rgba[p + 1] = rgb[i * 3 + 1]
    rgba[p + 2] = rgb[i * 3 + 2]
    rgba[p + 3] = mask[i]
  }
  const overlay = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()

  const healed = await sharp(offset).composite([{ input: overlay, blend: 'over' }]).toBuffer()
  return healed
}

// ---------------------------------------------------------------------------
// NOTE on a "tile-likelihood" gate: a meaningful share of the referenced
// clean_swatches sources are not tile face photos at all — they are
// catalogue brand cover pages, room lifestyle photography, or product shots
// (faucets, adhesive bags) that the original PDF-page extraction script
// mis-cropped. That is a real, separate pre-existing bug (see project notes)
// but it is NOT fixable by a border-crop/seamless-tiling pass — the wrong
// content is inside the crop, not around it. A local-variance-based "flat
// region" heuristic was tried here and rejected: legitimate marble/plain
// tile photography is itself very smooth in large areas (that's what
// polished stone looks like), so the heuristic quarantined ~1/3 of genuinely
// good tiles as false positives. Reliably distinguishing "a tile photo" from
// "a brand page" needs either manual curation or a real classifier — out of
// scope here. This script only fixes the border/margin defect; the content
// (right image vs. wrong image) is a separate, flagged, unresolved issue.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. Wrap-discontinuity validation on the final image.
// ---------------------------------------------------------------------------
async function measureWrapDiscontinuity(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const lum = (x, y) => {
    const i = (y * W + x) * C
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  let colDiff = 0, rowDiff = 0
  const stepY = Math.max(1, H >> 7)
  const stepX = Math.max(1, W >> 7)
  let n1 = 0, n2 = 0
  for (let y = 0; y < H; y += stepY) { colDiff += Math.abs(lum(0, y) - lum(W - 1, y)); n1++ }
  for (let x = 0; x < W; x += stepX) { rowDiff += Math.abs(lum(x, 0) - lum(x, H - 1)); n2++ }
  return { colDiff: colDiff / n1, rowDiff: rowDiff / n2 }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function processOne(filename) {
  const srcPath = path.join(SRC_DIR, filename)
  if (!fs.existsSync(srcPath)) return { filename, status: 'missing' }

  const meta = await sharp(srcPath).metadata()
  const { T, B, L, R } = await detectBorders(srcPath)
  const cropW = meta.width - L - R
  const cropH = meta.height - T - B
  if (cropW < 32 || cropH < 32) {
    return { filename, status: 'trim-failed' }
  }

  const trimmed = await sharp(srcPath)
    .extract({ left: L, top: T, width: cropW, height: cropH })
    .toBuffer()

  const results = {}
  for (const [variant, maxSide] of [['desktop', DESKTOP_MAX], ['mobile', MOBILE_MAX]]) {
    const { outW, outH } = potDims(cropW, cropH, maxSide)
    const resized = await sharp(trimmed).resize(outW, outH, { fit: 'fill' }).toBuffer()
    const healed = await makeSeamless(resized, outW, outH)
    results[variant] = { buffer: healed, width: outW, height: outH }
  }

  const { colDiff, rowDiff } = await measureWrapDiscontinuity(results.desktop.buffer)
  const DISCONTINUITY_THRESHOLD = 34 // mean abs luminance diff, 0-255 scale
  const passed = colDiff < DISCONTINUITY_THRESHOLD && rowDiff < DISCONTINUITY_THRESHOLD

  const base = filename.replace(/\.[^.]+$/, '')
  if (!passed) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true })
    await sharp(srcPath).toFile(path.join(QUARANTINE_DIR, filename))
    return { filename, status: 'quarantined', reason: 'wrap-discontinuity', colDiff, rowDiff, border: { T, B, L, R } }
  }

  const desktopName = `${base}@2048.webp`
  const mobileName = `${base}@1024.webp`
  await sharp(results.desktop.buffer).webp({ quality: WEBP_QUALITY }).toFile(path.join(OUT_DIR, desktopName))
  await sharp(results.mobile.buffer).webp({ quality: WEBP_QUALITY }).toFile(path.join(OUT_DIR, mobileName))

  return {
    filename,
    status: 'ok',
    desktop: `/assets/catalogue/visualizer_tiles/${desktopName}`,
    mobile: `/assets/catalogue/visualizer_tiles/${mobileName}`,
    width: results.desktop.width,
    height: results.desktop.height,
    aspect: +(results.desktop.width / results.desktop.height).toFixed(3),
    border: { T, B, L, R },
    colDiff: +colDiff.toFixed(1),
    rowDiff: +rowDiff.toFixed(1),
  }
}

async function buildContactSheet(entries) {
  const ok = entries.filter((e) => e.status === 'ok')
  if (!ok.length) return
  const CELL = 160
  const COLS = 16
  const rows = Math.ceil(ok.length / COLS)
  const sheetW = COLS * CELL
  const sheetH = rows * CELL
  const composites = []
  for (let i = 0; i < ok.length; i++) {
    const e = ok[i]
    const thumb = await sharp(path.join(OUT_DIR, path.basename(e.desktop)))
      .resize(CELL, CELL, { fit: 'cover' })
      .toBuffer()
    composites.push({ input: thumb, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL })
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: { r: 30, g: 30, b: 30 } } })
    .composite(composites)
    .webp({ quality: 80 })
    .toFile(path.join(OUT_DIR, '_contactsheet.webp'))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const files = collectReferencedFiles()
  console.log(`Found ${files.length} unique textures referenced by the visualizer.`)

  const results = []
  let ok = 0, quarantined = 0, missing = 0, trimFailed = 0
  for (const f of files) {
    process.stdout.write(`  processing ${f} ... `)
    try {
      const r = await processOne(f)
      results.push(r)
      if (r.status === 'ok') { ok++; console.log('ok') }
      else if (r.status === 'quarantined') { quarantined++; console.log(`QUARANTINED [${r.reason}] (col ${r.colDiff.toFixed(0)}, row ${r.rowDiff.toFixed(0)}, flat ${r.flatFraction})`) }
      else if (r.status === 'missing') { missing++; console.log('MISSING SOURCE') }
      else { trimFailed++; console.log('TRIM FAILED') }
    } catch (err) {
      results.push({ filename: f, status: 'error', error: String(err) })
      console.log('ERROR: ' + err.message)
    }
  }

  const manifest = {}
  for (const r of results) manifest[r.filename] = r
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  await buildContactSheet(results)

  console.log('')
  console.log(`Done. ok=${ok} quarantined=${quarantined} missing=${missing} trimFailed=${trimFailed} total=${files.length}`)
  console.log(`Manifest: ${MANIFEST_PATH}`)
  console.log(`Contact sheet: ${path.join(OUT_DIR, '_contactsheet.webp')}`)
  if (quarantined > 0) {
    console.log(`\n${quarantined} file(s) quarantined to ${QUARANTINE_DIR} — these fall back to the original clean_swatches/ source at runtime and need a manual look.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
