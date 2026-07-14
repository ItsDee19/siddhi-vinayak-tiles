// ---------------------------------------------------------------------------
// Tile texture generator — produces seamless 512×512px WebP textures from
// SVG patterns, matching the procedural painters in src/utils/textures.js.
//
// Usage:  node scripts/generate-textures.mjs
// Output: public/textures/*.webp
//
// Each texture is tileable (edge-safe) so RepeatWrapping in Three.js works
// without visible seams. Patterns use a deterministic PRNG seeded per product
// so results are reproducible.
// ---------------------------------------------------------------------------

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'textures')
const SIZE = 512

// --- deterministic PRNG (matches src/utils/textures.js) ----------------------

function rng(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function seedFrom(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

// --- color helpers ----------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

// --- SVG pattern generators (mirror the canvas painters) ---------------------

function svgWrap(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${content}</svg>`
}

function generateMarble(color, accent, seed) {
  const rand = rng(seedFrom(seed))
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="${color}"/>`

  // Cloudy blotches — 18 radial gradients
  for (let i = 0; i < 18; i++) {
    const x = (rand() * SIZE).toFixed(1)
    const y = (rand() * SIZE).toFixed(1)
    const r = ((0.1 + rand() * 0.35) * SIZE).toFixed(1)
    const shadeColor = shade(color, -10 + rand() * 20)
    const id = `blob${i}`
    s += `<defs><radialGradient id="${id}" cx="${x}" cy="${y}" r="${r}" gradientUnits="userSpaceOnUse">`
    s += `<stop offset="0" stop-color="${shadeColor}" stop-opacity="0.5"/>`
    s += `<stop offset="1" stop-color="${shadeColor}" stop-opacity="0"/>`
    s += `</radialGradient></defs>`
    s += `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id})"/>`
  }

  // Flowing veins — 5-8 quadratic curve paths
  const veinCount = 5 + Math.floor(rand() * 4)
  for (let v = 0; v < veinCount; v++) {
    let x = rand() * SIZE
    let y = 0
    let path = `M${x.toFixed(1)},${y}`
    const steps = 9
    for (let st = 1; st <= steps; st++) {
      const nx = x + (rand() - 0.5) * SIZE * 0.4
      const ny = (SIZE / steps) * st
      const cx = (x + nx) / 2 + (rand() - 0.5) * SIZE * 0.25
      const cy = (y + ny) / 2
      path += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)}`
      x = nx
      y = ny
    }
    const opacity = (0.25 + rand() * 0.4).toFixed(2)
    const width = (0.6 + rand() * 2.4).toFixed(1)
    s += `<path d="${path}" stroke="${accent}" stroke-width="${width}" stroke-opacity="${opacity}" fill="none"/>`
  }

  return svgWrap(s)
}

function generateGranite(color, accent, seed) {
  const rand = rng(seedFrom(seed))
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="${color}"/>`

  // Speckles — ~9000 small circles in varying shades
  const dots = Math.floor(SIZE * SIZE * 0.035)
  for (let i = 0; i < dots; i++) {
    const x = (rand() * SIZE).toFixed(1)
    const y = (rand() * SIZE).toFixed(1)
    const r = (rand() * 1.8).toFixed(1)
    const t = rand()
    const fill = t < 0.5
      ? shade(color, -35 - rand() * 35)
      : t < 0.8
        ? shade(color, 30 + rand() * 30)
        : accent
    const opacity = (0.5 + rand() * 0.5).toFixed(2)
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" fill-opacity="${opacity}"/>`
  }

  return svgWrap(s)
}

function generateQuartz(color, accent, seed) {
  const rand = rng(seedFrom(seed))
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="${color}"/>`

  // Gentle wide bands — 6 linear gradients
  for (let i = 0; i < 6; i++) {
    const x1 = (rand() * SIZE).toFixed(1)
    const y1 = (rand() * SIZE).toFixed(1)
    const x2 = SIZE
    const y2 = (rand() * SIZE).toFixed(1)
    const id = `band${i}`
    const bandColor = shade(color, -6)
    s += `<defs><linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">`
    s += `<stop offset="0" stop-color="${bandColor}" stop-opacity="0"/>`
    s += `<stop offset="0.5" stop-color="${bandColor}" stop-opacity="0.5"/>`
    s += `<stop offset="1" stop-color="${bandColor}" stop-opacity="0"/>`
    s += `</linearGradient></defs>`
    s += `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id})"/>`
  }

  // Fine sparkle — ~4700 tiny dots
  const dots = Math.floor(SIZE * SIZE * 0.018)
  for (let i = 0; i < dots; i++) {
    const x = (rand() * SIZE).toFixed(1)
    const y = (rand() * SIZE).toFixed(1)
    const fill = rand() < 0.7 ? shade(color, -20) : accent
    const opacity = (0.3 + rand() * 0.5).toFixed(2)
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" fill-opacity="${opacity}"/>`
  }

  return svgWrap(s)
}

function generateWood(color, accent, seed) {
  const rand = rng(seedFrom(seed))
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="${color}"/>`

  // Horizontal plank grain
  const planks = 4
  for (let p = 0; p < planks; p++) {
    const y0 = (SIZE / planks) * p
    // Plank seam
    s += `<rect x="0" y="${y0.toFixed(1)}" width="${SIZE}" height="1.5" fill="${shade(color, -8 - p * 2)}"/>`
    // Grain lines
    for (let g = 0; g < 22; g++) {
      let d = ''
      const yy = y0 + 6 + rand() * (SIZE / planks - 10)
      for (let x = 0; x <= SIZE; x += SIZE / 10) {
        const wy = yy + Math.sin(x * 0.05 + p) * 1.6 + (rand() - 0.5) * 1.2
        d += (x === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + wy.toFixed(1) + ' '
      }
      const stroke = shade(color, -18 + rand() * 14)
      const opacity = (0.15 + rand() * 0.25).toFixed(2)
      const width = (0.6 + rand()).toFixed(1)
      s += `<path d="${d}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}" fill="none"/>`
    }
  }

  return svgWrap(s)
}

function generateCeramic(color, accent, seed) {
  const rand = rng(seedFrom(seed))
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="${color}"/>`

  // Radial vignette
  const id = 'vig'
  s += `<defs><radialGradient id="${id}" cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE * 0.75}" gradientUnits="userSpaceOnUse">`
  s += `<stop offset="0" stop-color="${shade(color, 8)}" stop-opacity="0.5"/>`
  s += `<stop offset="1" stop-color="${shade(color, -12)}" stop-opacity="0.5"/>`
  s += `</radialGradient></defs>`
  s += `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id})"/>`

  // Faint speckle
  const dots = SIZE * 4
  for (let i = 0; i < dots; i++) {
    const x = (rand() * SIZE).toFixed(1)
    const y = (rand() * SIZE).toFixed(1)
    const opacity = (0.05 + rand() * 0.05).toFixed(2)
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${shade(color, -10)}" fill-opacity="${opacity}"/>`
  }

  return svgWrap(s)
}

// --- product → texture type mapping -----------------------------------------

const TEXTURE_PRODUCTS = [
  // Tiles
  { id: 'tile-001', type: 'marble',  color: '#E8E0D5', accent: '#9A9488', name: 'carrara-matte' },
  { id: 'tile-002', type: 'wood',    color: '#7c5a3c', accent: '#4a3422', name: 'walnut-wood' },
  { id: 'tile-003', type: 'ceramic', color: '#e9e1d3', accent: '#cbbfa6', name: 'ivory-glossy' },
  { id: 'tile-004', type: 'ceramic', color: '#6f6e6b', accent: '#4a4947', name: 'slate-grey' },
  // Marble
  { id: 'marble-001', type: 'marble',  color: '#f1ece2', accent: '#9A9488', name: 'statuario-white' },
  { id: 'marble-002', type: 'marble',  color: '#e3d4bb', accent: '#a8895f', name: 'crema-beige' },
  { id: 'marble-003', type: 'marble',  color: '#211f1d', accent: '#d8c7ad', name: 'noir-marquina' },
  // Granite
  { id: 'granite-001', type: 'granite', color: '#2a2826', accent: '#b08d4f', name: 'galaxy-black' },
  { id: 'granite-002', type: 'granite', color: '#d8d2c6', accent: '#7a6f5c', name: 'pearl-white' },
  { id: 'granite-003', type: 'granite', color: '#5a5854', accent: '#26241f', name: 'steel-grey' },
  // Quartz
  { id: 'quartz-001', type: 'quartz', color: '#f4f1ea', accent: '#cfc6b4', name: 'snow-quartz' },
  { id: 'quartz-002', type: 'quartz', color: '#e4d8c2', accent: '#b08d4f', name: 'champagne-quartz' },
]

const GENERATORS = {
  marble: generateMarble,
  granite: generateGranite,
  quartz: generateQuartz,
  wood: generateWood,
  ceramic: generateCeramic,
}

// --- main -------------------------------------------------------------------

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`Generating ${TEXTURE_PRODUCTS.length} textures at ${SIZE}×${SIZE}px WebP → ${OUT_DIR}\n`)

  for (const p of TEXTURE_PRODUCTS) {
    const gen = GENERATORS[p.type] || generateCeramic
    const svg = gen(p.color, p.accent, p.id)
    const outFile = join(OUT_DIR, `${p.name}.webp`)

    await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE)
      .webp({ quality: 85, effort: 4 })
      .toFile(outFile)

    const stat = await sharp(outFile).metadata()
    console.log(`  ✓ ${p.name}.webp  (${stat.width}×${stat.height}, ${stat.format})`)
  }

  console.log('\nDone. Update catalogue.js textureUrl fields to use /textures/<name>.webp')
}

main().catch((err) => {
  console.error('Texture generation failed:', err)
  process.exit(1)
})
