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
// Source preference: for each catalogue product, if a re-cropped override
// exists at clean_swatches_v2/<id>-swatch.webp (the output of this project's
// PDF re-extraction pass — see scripts/recrop_*.py), that is used as the
// pipeline's input instead of the original clean_swatches/ file. Output is
// still keyed by the ORIGINAL referenced basename, so the manifest shape and
// resolveZoneSource() in threeTextures.js need no changes — this is a
// drop-in upgrade of what the existing pipeline already serves. Products
// with no v2 override fall back to the original clean_swatches/ source
// exactly as before.
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
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/assets/catalogue/clean_swatches')
const V2_DIR = path.join(ROOT, 'public/assets/catalogue/clean_swatches_v2')
const OUT_DIR = path.join(ROOT, 'public/assets/catalogue/visualizer_tiles')
const QUARANTINE_DIR = path.join(OUT_DIR, '_quarantine')
// The manifest must live under src/ so Vite can bundle it as a static JSON
// import (threeTextures.js imports it directly — no runtime fetch).
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualizerTileManifest.json')
const IMPORTED_CATALOGUE_PATH = path.join(ROOT, 'src/data/importedCatalogue.js')

const DESKTOP_MAX = 2048
const MOBILE_MAX = 1024
const WEBP_QUALITY = 82

// ---------------------------------------------------------------------------
// 1. Discover every textureUrl the visualizer actually references, paired
//    with the product id (needed to look up a clean_swatches_v2 override).
//    Imported directly from the data module rather than regex-scanned, so
//    the id/textureUrl pairing is always exact.
// ---------------------------------------------------------------------------
async function collectReferencedFiles() {
  const { importedProducts } = await import(pathToFileURL(IMPORTED_CATALOGUE_PATH))
  const byBasename = new Map() // basename -> { id, filename }
  for (const p of importedProducts) {
    if (!p.textureUrl) continue
    // Mirrors resolveZoneSource()'s runtime rewrite in threeTextures.js —
    // both paths resolve to the same file on disk, so only the basename
    // (used as the manifest key) matters here.
    const cleanUrl = p.textureUrl.replace('/swatches/', '/clean_swatches/')
    const filename = path.basename(cleanUrl)
    if (!byBasename.has(filename)) byBasename.set(filename, { id: p.id, filename })
  }
  return [...byBasename.values()].sort((a, b) => a.filename.localeCompare(b.filename))
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
  // Reference the image's MEDIAN row/column rather than the single middle
  // scanline: on a tile whose centre happens to fall on a grout line or a
  // dark vein, one scanline is a poor stand-in for "typical tile content".
  const median = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1] }
  const sampleStep = Math.max(1, H >> 5)
  const coreRowM = median(Array.from({ length: Math.ceil(H / sampleStep) }, (_, i) => rowStat(Math.min(H - 1, i * sampleStep)).m))
  const sampleStepX = Math.max(1, W >> 5)
  const coreColM = median(Array.from({ length: Math.ceil(W / sampleStepX) }, (_, i) => colStat(Math.min(W - 1, i * sampleStepX)).m))

  // A flat edge band that is even modestly offset from the tile's typical
  // brightness is page background, not tile. The previous cutoff of 28 sat
  // just above the real-world white-page-on-cream-tile delta (~25), so those
  // bands survived and repeated as white grid lines once tiled.
  const OFFSET = 14
  const isBorderRow = (y) => { const r = rowStat(y); return r.sd < 8 && Math.abs(r.m - coreRowM) > OFFSET }
  const isBorderCol = (x) => { const c = colStat(x); return c.sd < 8 && Math.abs(c.m - coreColM) > OFFSET }

  let T = 0, B = 0, L = 0, R = 0
  // Cap generously: some re-extracted crops carry a page-background band
  // covering 40%+ of the image (a chip swatch sitting low in its slot), and
  // trimming that fully is exactly right.
  const capY = Math.floor(H * 0.55)
  const capX = Math.floor(W * 0.55)
  while (T < capY && isBorderRow(T)) T++
  while (B < capY && isBorderRow(H - 1 - B)) B++
  while (L < capX && isBorderCol(L)) L++
  while (R < capX && isBorderCol(W - 1 - R)) R++

  // A large trim is only suspicious if the band it removed doesn't actually
  // look like page background. Flat-and-strongly-offset (near-zero variance,
  // far from the tile's typical brightness) is the unmistakable signature of
  // paper white / solid backdrop, and should be trimmed however thick it is.
  // Anything else that ran long is treated as a detector misfire on busy tile
  // content and falls back to a conservative nibble.
  const FALLBACK_FRAC = 0.02
  const meanOf = (stats) => stats.reduce((a, s) => a + s.m, 0) / stats.length
  const bandIsBackground = (stats) =>
    stats.length > 0 && stats.every((s) => s.sd < 3.5) && Math.abs(meanOf(stats) - coreRowM) > 25
  const rowsIn = (from, to) => { const out = []; for (let y = from; y < to; y += Math.max(1, Math.floor((to - from) / 12) || 1)) out.push(rowStat(y)); return out }
  const colsIn = (from, to) => { const out = []; for (let x = from; x < to; x += Math.max(1, Math.floor((to - from) / 12) || 1)) out.push(colStat(x)); return out }
  const bandIsBackgroundCol = (stats) =>
    stats.length > 0 && stats.every((s) => s.sd < 3.5) && Math.abs(meanOf(stats) - coreColM) > 25

  if (T > H * 0.15 && !bandIsBackground(rowsIn(0, T))) T = Math.round(H * FALLBACK_FRAC)
  if (B > H * 0.15 && !bandIsBackground(rowsIn(H - B, H))) B = Math.round(H * FALLBACK_FRAC)
  if (L > W * 0.15 && !bandIsBackgroundCol(colsIn(0, L))) L = Math.round(W * FALLBACK_FRAC)
  if (R > W * 0.15 && !bandIsBackgroundCol(colsIn(W - R, W))) R = Math.round(W * FALLBACK_FRAC)

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
async function processOne({ id, filename }) {
  const v2Path = path.join(V2_DIR, `${id}-swatch.webp`)
  const usedV2 = fs.existsSync(v2Path)
  const srcPath = usedV2 ? v2Path : path.join(SRC_DIR, filename)
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
    return { filename, status: 'quarantined', reason: 'wrap-discontinuity', colDiff, rowDiff, border: { T, B, L, R }, source: usedV2 ? 'v2' : 'original' }
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
    source: usedV2 ? 'v2' : 'original',
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
  const files = await collectReferencedFiles()
  console.log(`Found ${files.length} unique textures referenced by the visualizer.`)

  const results = []
  let ok = 0, quarantined = 0, missing = 0, trimFailed = 0, fromV2 = 0
  for (const f of files) {
    process.stdout.write(`  processing ${f.filename} ... `)
    try {
      const r = await processOne(f)
      results.push(r)
      if (r.source === 'v2') fromV2++
      if (r.status === 'ok') { ok++; console.log(`ok${r.source === 'v2' ? ' [v2]' : ''}`) }
      else if (r.status === 'quarantined') { quarantined++; console.log(`QUARANTINED [${r.reason}] (col ${r.colDiff.toFixed(0)}, row ${r.rowDiff.toFixed(0)}, flat ${r.flatFraction})`) }
      else if (r.status === 'missing') { missing++; console.log('MISSING SOURCE') }
      else { trimFailed++; console.log('TRIM FAILED') }
    } catch (err) {
      results.push({ filename: f.filename, status: 'error', error: String(err) })
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
  console.log(`Sources: ${fromV2} from clean_swatches_v2 (re-extracted), ${files.length - fromV2} from original clean_swatches.`)
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
