#!/usr/bin/env node
// =============================================================================
// preview_surface_maps.mjs
//
// Renders albedo | normal | roughness strips for a sample of tiles, so the
// derived-map maths can be inspected rather than trusted.
//
// This imports src/utils/surfaceMapMath.js — the exact module the browser
// runs — so what you look at here is what ships. It writes nothing the site
// uses; output goes to the gitignored build-artifacts/ directory.
//
// Run:  node scripts/preview_surface_maps.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { computeSurfaceMaps } from '../src/utils/surfaceMapMath.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TILES = path.join(ROOT, 'public/assets/catalogue/visualizer_tiles')
const OUT = path.join(ROOT, 'build-artifacts/surface_maps')

const SIZE = 512
const CELL_W = 300

async function mapsFor(file) {
  const meta = await sharp(file).metadata()
  const aspect = meta.width / meta.height
  const W = aspect >= 1 ? SIZE : Math.max(8, Math.round(SIZE * aspect))
  const H = aspect >= 1 ? Math.max(8, Math.round(SIZE / aspect)) : SIZE

  const { data } = await sharp(file)
    .resize(W, H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const m = computeSurfaceMaps(data, W, H)
  const toPng = (buf) =>
    sharp(Buffer.from(buf), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()

  return { W, H, roughnessMean: m.roughnessMean, normal: await toPng(m.normal), roughness: await toPng(m.roughness) }
}

async function main() {
  const all = fs.readdirSync(TILES).filter((f) => f.endsWith('@1024.webp'))
  if (!all.length) {
    console.error('No tiles found — run scripts/build_visualizer_tiles.mjs first.')
    process.exit(1)
  }
  // Spread the sample across the range rather than taking the first N, which
  // would be one family only.
  const step = Math.max(1, Math.floor(all.length / 8))
  const sample = all.filter((_, i) => i % step === 0).slice(0, 8)

  fs.mkdirSync(OUT, { recursive: true })
  const rows = []
  for (const name of sample) {
    const file = path.join(TILES, name)
    const m = await mapsFor(file)
    const cellH = Math.max(60, Math.round(CELL_W / (m.W / m.H)))
    const strip = await sharp({
      create: { width: CELL_W * 3, height: cellH, channels: 3, background: { r: 20, g: 20, b: 20 } },
    })
      .composite([
        { input: await sharp(file).resize(CELL_W, cellH, { fit: 'fill' }).toBuffer(), left: 0, top: 0 },
        { input: await sharp(m.normal).resize(CELL_W, cellH, { fit: 'fill' }).toBuffer(), left: CELL_W, top: 0 },
        { input: await sharp(m.roughness).resize(CELL_W, cellH, { fit: 'fill' }).toBuffer(), left: CELL_W * 2, top: 0 },
      ])
      .png()
      .toBuffer()
    rows.push({ strip, h: cellH })
    console.log(`  ${name.padEnd(44)} ${m.W}x${m.H}  roughnessMean=${m.roughnessMean.toFixed(3)}`)
  }

  const totalH = rows.reduce((a, r) => a + r.h, 0)
  let top = 0
  const composites = rows.map((r) => {
    const c = { input: r.strip, left: 0, top }
    top += r.h
    return c
  })
  const outFile = path.join(OUT, 'albedo_normal_roughness.png')
  await sharp({ create: { width: CELL_W * 3, height: totalH, channels: 3, background: { r: 20, g: 20, b: 20 } } })
    .composite(composites)
    .png()
    .toFile(outFile)

  console.log(`\ncolumns: albedo | normal | roughness`)
  console.log(`-> ${outFile}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
