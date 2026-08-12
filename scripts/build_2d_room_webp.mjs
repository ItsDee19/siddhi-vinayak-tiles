/**
 * Convert 2D room pack PNGs → WebP for faster first paint.
 * - base / overlay: lossy q82
 * - masks: lossless (keep clean edges)
 *
 *   node scripts/build_2d_room_webp.mjs
 *   node scripts/build_2d_room_webp.mjs --rooms bathroom-01 large-bathroom-b
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'public', '2d-rooms')

const DEFAULT_ROOMS = [
  'bathroom-01',
  'large-bathroom-b',
  'staircase-c',
  'feature-wall-d',
  'vanity-e',
]

const args = process.argv.slice(2)
const roomIdx = args.indexOf('--rooms')
const rooms =
  roomIdx >= 0
    ? args.slice(roomIdx + 1).filter((a) => !a.startsWith('--'))
    : DEFAULT_ROOMS

let saved = 0
for (const id of rooms) {
  const dir = path.join(ROOT, id)
  if (!fs.existsSync(dir)) {
    console.warn('skip missing', id)
    continue
  }
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.png')) continue
    if (!/^(base|overlay-locked|mask-)/.test(name)) continue
    const src = path.join(dir, name)
    const dest = src.replace(/\.png$/i, '.webp')
    const isMask = name.startsWith('mask-')
    const pipeline = sharp(src)
    if (isMask) {
      await pipeline.webp({ lossless: true, effort: 4 }).toFile(dest)
    } else {
      await pipeline.webp({ quality: 82, effort: 4, alphaQuality: 90 }).toFile(dest)
    }
    const a = fs.statSync(src).size
    const b = fs.statSync(dest).size
    saved += a - b
    console.log(
      `${id}/${name}: ${Math.round(a / 1024)}KB → ${Math.round(b / 1024)}KB (${Math.round((100 * b) / a)}%)`,
    )
  }
}
console.log(`Done. ~${Math.round(saved / 1024)}KB smaller if PNG fallbacks unused.`)
