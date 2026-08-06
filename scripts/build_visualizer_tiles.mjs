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
// only the images the 3D visualizer actually references, and writes NEW,
// separate outputs.
//
// Source preference: for each catalogue product, if a re-cropped override
// exists at clean_swatches_v2/<id>-swatch.webp (the output of this project's
// PDF re-extraction pass — see scripts/recrop_*.py), that is used as the
// pipeline's input instead of the original clean_swatches/ file. Output is
// still keyed by the ORIGINAL referenced basename. Products with no v2
// override fall back to the original clean_swatches/ source.
//
//   public/assets/catalogue/visualizer_tiles/   (shipped)
//     <name>@2048.webp   — desktop variant
//     <name>@1024.webp   — mobile variant
//
//   src/data/visualizerTileManifest.json        (shipped, bundled into the JS)
//     name -> { desktop, mobile, aspect }, usable sources only
//
//   build-artifacts/visualizer_tiles/           (review only, gitignored)
//     _report.json        — every source with its status, reason and measurements
//     _contactsheet.webp  — grid of every processed tile, for a one-look QA pass
//     _rejected/          — crops the content gate refused
//     _quarantine/        — inputs whose auto-crop failed validation
//
// Pipeline per image:
//   0. Reject crops that are not tile faces at all (brand pages, room photos,
//      spec tables, adhesive-bag product shots) — see tileContentGate.mjs.
//      Rejected sources are left out of the shipped manifest and their trimmed
//      crop written to _rejected/ for review. The runtime drops the product
//      rather than falling back to the raw crop.
//   1. Detect a per-image border frame (not a per-family constant — measured
//      border widths vary widely even within one family) by walking in from
//      each edge while that row/column is both low-variance and offset in
//      mean luminance from the image core. Capped at 30% per side; if a
//      single side's detected trim would exceed 15%, that side falls back to
//      a conservative fixed 2% trim instead (guards against the detector
//      misfiring on a genuinely busy tile, e.g. dark granite with light veins
//      near an edge).
//   2. Resize: power-of-two on the long side, exact aspect on the short side,
//      so the tile's real proportions survive into the texture.
//   3. Make it wrap-seamless by cross-fading a narrow band at each edge with
//      the mirrored opposite edge. The middle ~88% of the tile face — its
//      pattern, shape and registration — is left exactly as photographed.
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
import { gate } from './tileContentGate.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/assets/catalogue/clean_swatches')
const V2_DIR = path.join(ROOT, 'public/assets/catalogue/clean_swatches_v2')
const OUT_DIR = path.join(ROOT, 'public/assets/catalogue/visualizer_tiles')
// Review-only output. Kept OUT of public/ — Vite copies public/ verbatim into
// dist/, so writing the rejected crops, the quarantine and the contact sheet
// there shipped ~7MB of QA material to production on every deploy.
const REVIEW_DIR = path.join(ROOT, 'build-artifacts/visualizer_tiles')
const QUARANTINE_DIR = path.join(REVIEW_DIR, '_quarantine')
// The manifest must live under src/ so Vite can bundle it as a static JSON
// import (threeTextures.js imports it directly — no runtime fetch).
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualizerTileManifest.json')
const VISUALIZER_CANDIDATES_PATH = path.join(ROOT, 'src/data/visualizerCandidates.js')
const REJECT_DIR = path.join(REVIEW_DIR, '_rejected')

const DESKTOP_MAX = 2048
const MOBILE_MAX = 1024
const WEBP_QUALITY = 82

// ---------------------------------------------------------------------------
// 1. Discover every textureUrl the visualizer actually references, paired
//    with the product id (needed to look up a clean_swatches_v2 override).
//    Imported directly from the data module rather than regex-scanned, so
//    the id/textureUrl pairing is always exact.
//
//    Source of truth is visualizerCandidates.js, NOT importedCatalogue.js.
//    The visualizer serves both: the imported catalogue products *and* ~750
//    extra PDF-page-derived products declared only for the visualizer.
//    Collecting from importedCatalogue meant those 750 never entered this
//    pipeline at all — no border trim, no seam handling, no content check —
//    and threeTextures.js quietly fell back to serving the raw page crop.
//    That is how a catalogue cover page ended up tiled across a 3D wall.
// ---------------------------------------------------------------------------
async function collectReferencedFiles() {
  // `visualizerCandidates`, not `visualizerProducts` — the latter is already
  // filtered by this script's own previous manifest, so reading it would make
  // rejections permanent and unrecoverable across runs.
  const { visualizerCandidates } = await import(pathToFileURL(VISUALIZER_CANDIDATES_PATH))
  const byBasename = new Map() // basename -> { id, filename }
  for (const p of visualizerCandidates) {
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
// 3. Output dimensions: power-of-two on the long side, exact aspect on the
//    short side.
//
//    Both sides used to be snapped to a power of two independently, which
//    quietly distorted the tile's shape — a 1323x365 crop (3.62:1) came out
//    1024x256 (4.00:1), a 10% stretch baked into the texture before it ever
//    reached a wall. The short side is now derived from the true aspect and
//    only rounded to a multiple of 4. Non-power-of-two textures with mipmaps
//    and RepeatWrapping are fully supported on WebGL2, which is what
//    three r169 renders with.
// ---------------------------------------------------------------------------
function nearestPOT(n) {
  return Math.pow(2, Math.round(Math.log2(n)))
}
function potDims(w, h, maxSide) {
  const aspect = w / h
  const round4 = (n) => Math.max(64, Math.round(n / 4) * 4)
  let outW, outH
  if (aspect >= 1) {
    outW = Math.max(64, Math.min(maxSide, nearestPOT(w)))
    outH = round4(outW / aspect)
  } else {
    outH = Math.max(64, Math.min(maxSide, nearestPOT(h)))
    outW = round4(outH * aspect)
  }
  return { outW, outH }
}

// ---------------------------------------------------------------------------
// 4. Seamless tiling via a narrow edge cross-fade.
//
//    This replaces an offset-by-half + blur-the-centre-cross implementation.
//    That is a standard trick for organic textures, but it is the wrong tool
//    for a tile: swapping quadrants tears the tile's pattern apart and moves
//    it off-register (a marble slab's veining ends up in four disconnected
//    corners), and the heal step painted a permanent soft blurred cross
//    through the middle of every single tile — visible on a rendered wall as
//    exactly the smeared bands this pipeline was supposed to remove.
//
//    Instead: leave the tile face alone and cross-fade only a narrow band at
//    each edge with the mirrored content of the opposite edge. Weight is 0.5
//    exactly at the boundary — so column 0 and column W-1 converge on the
//    same value and the wrap is continuous — decaying to 0 by the inner end
//    of the band. The middle ~88% of the tile is untouched, so the pattern,
//    its shape, and its position are all preserved.
// ---------------------------------------------------------------------------
const BAND_FRAC = 0.06

async function makeWrapSeamless(buffer, W, H) {
  const { data } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  const at = (x, y) => (y * W + x) * 3

  // Horizontal wrap: blend the left band with the mirrored right band.
  const bw = Math.max(2, Math.round(W * BAND_FRAC))
  for (let y = 0; y < H; y++) {
    for (let i = 0; i < bw; i++) {
      const t = 0.5 * (1 - i / bw)
      const lp = at(i, y)
      const rp = at(W - 1 - i, y)
      for (let c = 0; c < 3; c++) {
        const l = data[lp + c]
        const r = data[rp + c]
        out[lp + c] = Math.round(l * (1 - t) + r * t)
        out[rp + c] = Math.round(r * (1 - t) + l * t)
      }
    }
  }

  // Vertical wrap, applied to the horizontally-blended result so the corners
  // stay consistent with both passes.
  const src = Buffer.from(out)
  const bh = Math.max(2, Math.round(H * BAND_FRAC))
  for (let x = 0; x < W; x++) {
    for (let i = 0; i < bh; i++) {
      const t = 0.5 * (1 - i / bh)
      const tp = at(x, i)
      const bp = at(x, H - 1 - i)
      for (let c = 0; c < 3; c++) {
        const a = src[tp + c]
        const b = src[bp + c]
        out[tp + c] = Math.round(a * (1 - t) + b * t)
        out[bp + c] = Math.round(b * (1 - t) + a * t)
      }
    }
  }

  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
}

// ---------------------------------------------------------------------------
// NOTE on the tile-content gate: a meaningful share of the referenced
// clean_swatches sources are not tile face photos at all — they are catalogue
// brand cover pages, room lifestyle photography, or product shots (faucets,
// adhesive bags) that the original PDF-page extraction script mis-cropped.
// This was previously left unfixed here on the grounds that a local-variance
// "flat region" heuristic quarantined ~1/3 of genuinely good tiles, since
// polished stone is itself very smooth over large areas.
//
// That conclusion held for local variance alone. Four other statistics do
// separate the classes well, and are implemented in tileContentGate.mjs:
// paper flatness (bright AND dead-uniform, which white marble is not), flat
// saturated vector art, glyph-edge density, and block-level homogeneity
// (a tile face is one material edge to edge; a room photo is not). Measured
// over the full 1226-source corpus this rejects ~49%, and spot-checking the
// contact sheets on both sides of the decision shows the accepted set is
// dominated by real tile faces and the rejected set by brochure furniture.
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

// Write a webp, retrying briefly on a transient lock.
//
// On Windows any process watching public/ — most commonly the Vite dev server,
// which is usually running while someone reruns this script — can hold a
// handle on a file just long enough for the overwrite to fail with "unable to
// open for write". Observed on a different handful of tiles every run, each
// time silently dropping those tiles from the manifest. A short backoff is
// enough; the lock is only ever held for a moment.
async function writeWebp(buffer, outPath, attempts = 5) {
  for (let i = 0; ; i++) {
    try {
      await sharp(buffer).webp({ quality: WEBP_QUALITY }).toFile(outPath)
      return
    } catch (err) {
      if (i >= attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 100 * (i + 1)))
    }
  }
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

  // Content gate — is this crop a tile face at all? See tileContentGate.mjs.
  // Runs on the trimmed image, since border trimming is what decides the
  // usable resolution and aspect the gate reasons about.
  const verdict = await gate(trimmed, cropW, cropH)
  if (!verdict.ok) {
    fs.mkdirSync(REJECT_DIR, { recursive: true })
    await sharp(trimmed).webp({ quality: 70 }).toFile(path.join(REJECT_DIR, filename))
    return {
      filename,
      status: 'rejected',
      reason: verdict.reason,
      source: usedV2 ? 'v2' : 'original',
    }
  }

  const results = {}
  for (const [variant, maxSide] of [['desktop', DESKTOP_MAX], ['mobile', MOBILE_MAX]]) {
    const { outW, outH } = potDims(cropW, cropH, maxSide)
    const resized = await sharp(trimmed).resize(outW, outH, { fit: 'fill' }).toBuffer()
    const healed = await makeWrapSeamless(resized, outW, outH)
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
  await writeWebp(results.desktop.buffer, path.join(OUT_DIR, desktopName))
  await writeWebp(results.mobile.buffer, path.join(OUT_DIR, mobileName))

  return {
    filename,
    status: 'ok',
    desktop: `/assets/catalogue/visualizer_tiles/${desktopName}`,
    mobile: `/assets/catalogue/visualizer_tiles/${mobileName}`,
    width: results.desktop.width,
    height: results.desktop.height,
    // The shipped texture's aspect. GLBModel.computeRepeat trusts this over
    // the product's declared `size` when deciding how the tile lies on a
    // surface, because a good part of the catalogue's declared sizes are
    // wrong (76x300mm 3x12 tiles are all labelled "300x600mm").
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
    .toFile(path.join(REVIEW_DIR, '_contactsheet.webp'))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const files = await collectReferencedFiles()
  console.log(`Found ${files.length} unique textures referenced by the visualizer.`)

  const results = []
  let ok = 0, quarantined = 0, missing = 0, trimFailed = 0, fromV2 = 0
  const rejected = {}
  for (const f of files) {
    process.stdout.write(`  processing ${f.filename} ... `)
    try {
      const r = await processOne(f)
      results.push(r)
      if (r.source === 'v2') fromV2++
      if (r.status === 'ok') { ok++; console.log(`ok${r.source === 'v2' ? ' [v2]' : ''}`) }
      else if (r.status === 'rejected') { rejected[r.reason] = (rejected[r.reason] || 0) + 1; console.log(`REJECTED [${r.reason}]`) }
      else if (r.status === 'quarantined') { quarantined++; console.log(`QUARANTINED [${r.reason}] (col ${r.colDiff.toFixed(0)}, row ${r.rowDiff.toFixed(0)})`) }
      else if (r.status === 'missing') { missing++; console.log('MISSING SOURCE') }
      else { trimFailed++; console.log('TRIM FAILED') }
    } catch (err) {
      results.push({ filename: f.filename, status: 'error', error: String(err) })
      console.log('ERROR: ' + err.message)
    }
  }

  // The shipped manifest is bundled into the JS and parsed on every page load,
  // so it carries only what the runtime actually reads: the two variant URLs
  // and the texture's aspect. Presence of a key means "usable" — rejected,
  // quarantined and failed sources are simply absent. Keeping every entry with
  // its full diagnostics here cost ~200KB of dead payload.
  const manifest = {}
  for (const r of results) {
    if (r.status !== 'ok') continue
    manifest[r.filename] = { desktop: r.desktop, mobile: r.mobile, aspect: r.aspect }
  }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  // Full per-source record — statuses, rejection reasons, detected borders,
  // measured discontinuity — for review. Never shipped.
  fs.mkdirSync(REVIEW_DIR, { recursive: true })
  const report = {}
  for (const r of results) report[r.filename] = r
  fs.writeFileSync(path.join(REVIEW_DIR, '_report.json'), JSON.stringify(report, null, 2))

  await buildContactSheet(results)

  const rejectedTotal = Object.values(rejected).reduce((a, v) => a + v, 0)
  console.log('')
  console.log(`Done. ok=${ok} rejected=${rejectedTotal} quarantined=${quarantined} missing=${missing} trimFailed=${trimFailed} total=${files.length}`)
  if (rejectedTotal > 0) {
    console.log(`Rejected by content gate: ${Object.entries(rejected).map(([k, v]) => `${k}=${v}`).join(' ')}`)
    console.log(`  crops written to ${REJECT_DIR} for review.`)
  }
  console.log(`Sources: ${fromV2} from clean_swatches_v2 (re-extracted), ${files.length - fromV2} from original clean_swatches.`)
  console.log(`Manifest: ${MANIFEST_PATH}`)
  console.log(`Contact sheet: ${path.join(REVIEW_DIR, '_contactsheet.webp')}`)
  if (quarantined > 0) {
    console.log(`\n${quarantined} file(s) quarantined to ${QUARANTINE_DIR}. Anything not marked 'ok' is dropped from the visualizer entirely — there is no raw-crop fallback any more.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
