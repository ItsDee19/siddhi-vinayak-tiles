#!/usr/bin/env node
// =============================================================================
// build_product_facets.mjs
//
// Derives the catalogue's COLOUR facet from the actual tile imagery, and writes
// src/data/productFacets.json (id -> { color, hex }).
//
// Why this exists: the catalogue's `color` field is a placeholder. 554 of 557
// products carry the identical hex #e5dec9, so the Catalogue section's colour
// filter mapped 556 of 557 products to "Beige" and the other eight colour pills
// returned nothing at all. Colour is the first thing anyone filters a tile
// range by, so the fix is to measure it rather than to delete the filter.
//
// Source preference per product:
//   1. the processed visualizer tile — a clean, border-free tile face
//   2. the catalogue product photo
// The tile face is preferred because the product photo can include packaging,
// page background or a room setting, all of which drag the average off the
// tile's real colour.
//
// Run:  node scripts/build_product_facets.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CATALOGUE_PATH = path.join(ROOT, 'src/data/catalogue.js')
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualizerTileManifest.json')
const OUT_PATH = path.join(ROOT, 'src/data/productFacets.json')
const REVIEW_DIR = path.join(ROOT, 'build-artifacts/product_facets')

// Mean lightness, saturation and a saturation-weighted circular mean hue over
// the centre of the image. The centre crop avoids edge vignetting and any
// residual page margin on the product-photo sources.
async function measureColor(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .resize(96, 96, { fit: 'cover', position: 'centre' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: W, height: H, channels: C } = info
  let sumL = 0, sumS = 0, hx = 0, hy = 0, sw = 0, n = 0
  let sumR = 0, sumG = 0, sumB = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const chroma = mx - mn
      const L = 0.299 * r + 0.587 * g + 0.114 * b
      const S = mx === 0 ? 0 : chroma / mx
      let h = 0
      if (chroma > 0) {
        if (mx === r) h = (((g - b) / chroma) % 6 + 6) % 6
        else if (mx === g) h = (b - r) / chroma + 2
        else h = (r - g) / chroma + 4
        h *= 60
      }
      const rad = (h * Math.PI) / 180
      // Weight the hue average by saturation: near-neutral pixels carry no
      // reliable hue and would otherwise pull the mean toward noise.
      hx += Math.cos(rad) * S
      hy += Math.sin(rad) * S
      sw += S
      sumL += L; sumS += S; sumR += r; sumG += g; sumB += b; n++
    }
  }

  let hue = (Math.atan2(hy / (sw || 1), hx / (sw || 1)) * 180) / Math.PI
  if (hue < 0) hue += 360
  return {
    L: sumL / n,
    S: sumS / n,
    hue,
    hex: '#' + [sumR, sumG, sumB].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''),
  }
}

// Classify into a family. Tile ranges are dominated by warm near-neutrals, so
// the neutral/chromatic split is deliberately generous toward neutrals: a
// cream tile with a faint gold vein is a cream tile, not a gold one.
export function classifyColor({ L, S, hue }) {
  if (S < 0.10) {
    if (L >= 205) return 'White'
    if (L >= 130) return 'Grey'
    if (L >= 80) return 'Grey'
    return 'Charcoal'
  }

  // Warm low-saturation band — where cream and beige actually live.
  if (S < 0.28 && hue >= 20 && hue < 70) {
    if (L >= 215) return 'White'
    if (L >= 175) return 'Cream'
    if (L >= 110) return 'Beige'
    return 'Brown'
  }

  if (S < 0.16) {
    if (L >= 205) return 'White'
    if (L >= 80) return 'Grey'
    return 'Charcoal'
  }

  if (hue < 20 || hue >= 340) return L < 90 ? 'Charcoal' : 'Terracotta'
  if (hue < 45) return L < 105 ? 'Brown' : (S > 0.42 ? 'Terracotta' : 'Brown')
  if (hue < 70) return L < 110 ? 'Brown' : 'Gold'
  if (hue < 170) return 'Green'
  if (hue < 265) return 'Blue'
  return L < 90 ? 'Charcoal' : 'Terracotta'
}

async function main() {
  const { products } = await import(pathToFileURL(CATALOGUE_PATH))
  // The families this script classifies into must be exactly the ones the
  // filter UI renders pills for, so both read the same list.
  const { COLOR_SWATCHES } = await import(pathToFileURL(path.join(ROOT, 'src/data/colorFamilies.js')))
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const manifestKey = (u) => u.replace('/swatches/', '/clean_swatches/').split('/').pop()

  const facets = {}
  const counts = {}
  const byFamily = {}
  let fromTile = 0, fromPhoto = 0, skipped = 0

  for (const p of products) {
    const entry = p.textureUrl ? manifest[manifestKey(p.textureUrl)] : null
    let src = null
    if (entry) { src = path.join(ROOT, 'public', entry.desktop); fromTile++ }
    else if (p.imageUrl && fs.existsSync(path.join(ROOT, 'public', p.imageUrl))) {
      src = path.join(ROOT, 'public', p.imageUrl); fromPhoto++
    }
    if (!src || !fs.existsSync(src)) { skipped++; continue }

    try {
      const m = await measureColor(src)
      const color = classifyColor(m)
      facets[p.id] = { color, hex: m.hex }
      counts[color] = (counts[color] || 0) + 1
      ;(byFamily[color] ||= []).push({ id: p.id, name: p.name, src })
    } catch {
      skipped++
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(facets, null, 2))

  // Contact sheet per colour family, so the classification can be eyeballed
  // rather than trusted.
  fs.mkdirSync(REVIEW_DIR, { recursive: true })
  for (const [family, items] of Object.entries(byFamily)) {
    const CELL = 110, COLS = 14
    const shown = items.slice(0, COLS * 8)
    const rows = Math.max(1, Math.ceil(shown.length / COLS))
    const comps = []
    for (let i = 0; i < shown.length; i++) {
      try {
        const buf = await sharp(shown[i].src).resize(CELL, CELL, { fit: 'cover' }).toBuffer()
        comps.push({ input: buf, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL })
      } catch { /* skip unreadable */ }
    }
    await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: { r: 24, g: 24, b: 24 } } })
      .composite(comps).webp({ quality: 80 })
      .toFile(path.join(REVIEW_DIR, `${family}.webp`))
  }

  console.log('Colour facet built for', Object.keys(facets).length, 'products')
  console.log('  sources:', fromTile, 'clean tiles,', fromPhoto, 'product photos,', skipped, 'skipped')
  console.log('  distribution:')
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${k}`)
  }
  const unknown = Object.keys(counts).filter((k) => !(k in COLOR_SWATCHES))
  if (unknown.length) {
    console.warn('  WARNING: families with no swatch in src/data/colorFamilies.js:', unknown.join(', '))
  }
  console.log('  ->', OUT_PATH)
  console.log('  review sheets ->', REVIEW_DIR)
}

main().catch((err) => { console.error(err); process.exit(1) })
