#!/usr/bin/env node
// =============================================================================
// preview_environment_hdr.mjs
//
// Decodes public/hdri/showroom.hdr back from disk and writes a tone-mapped PNG
// so the environment can be looked at, plus a set of exposure steps that show
// where the real dynamic range sits.
//
// Decoding the FILE (rather than re-running the generator's sample function)
// is the point: it round-trips the RGBE + RLE encoding, so a broken encoder
// shows up here instead of as a silently wrong environment in the browser.
//
// Run:  node scripts/preview_environment_hdr.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HDR = path.join(ROOT, 'public/hdri/showroom.hdr')
const OUT = path.join(ROOT, 'build-artifacts/hdri')

function decodeHDR(buf) {
  // --- header
  let pos = 0
  const readLine = () => {
    let s = ''
    while (buf[pos] !== 0x0a) { s += String.fromCharCode(buf[pos]); pos++ }
    pos++
    return s
  }
  const magic = readLine()
  if (!magic.startsWith('#?')) throw new Error('not a Radiance file: ' + magic)
  let line
  while ((line = readLine()) !== '') { /* FORMAT / comments */ }
  const dims = readLine().match(/-Y (\d+) \+X (\d+)/)
  if (!dims) throw new Error('unsupported resolution line')
  const H = +dims[1], W = +dims[2]

  const rgbe = new Uint8Array(W * H * 4)
  const comps = [new Uint8Array(W), new Uint8Array(W), new Uint8Array(W), new Uint8Array(W)]

  for (let y = 0; y < H; y++) {
    const h0 = buf[pos++], h1 = buf[pos++], h2 = buf[pos++], h3 = buf[pos++]
    if (h0 !== 2 || h1 !== 2) throw new Error(`scanline ${y}: expected new-style RLE header`)
    const lineW = (h2 << 8) | h3
    if (lineW !== W) throw new Error(`scanline ${y}: width ${lineW} != ${W}`)

    for (let c = 0; c < 4; c++) {
      let x = 0
      while (x < W) {
        const count = buf[pos++]
        if (count > 128) {
          const n = count - 128
          const v = buf[pos++]
          for (let i = 0; i < n; i++) comps[c][x++] = v
        } else {
          for (let i = 0; i < count; i++) comps[c][x++] = buf[pos++]
        }
      }
      if (x !== W) throw new Error(`scanline ${y} comp ${c}: decoded ${x} of ${W}`)
    }
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      rgbe[i] = comps[0][x]; rgbe[i + 1] = comps[1][x]
      rgbe[i + 2] = comps[2][x]; rgbe[i + 3] = comps[3][x]
    }
  }
  if (pos !== buf.length) console.warn(`  note: ${buf.length - pos} trailing bytes`)
  return { W, H, rgbe }
}

function toFloat(rgbe, i) {
  const e = rgbe[i + 3]
  if (e === 0) return [0, 0, 0]
  const f = Math.pow(2, e - 136) // 2^(e-128) / 256
  return [rgbe[i] * f, rgbe[i + 1] * f, rgbe[i + 2] * f]
}

async function main() {
  const { W, H, rgbe } = decodeHDR(fs.readFileSync(HDR))
  console.log(`decoded ${W}x${H} OK — RGBE + RLE round-trips`)

  // Dynamic range report
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < W * H * 4; i += 4) {
    const [r, g, b] = toFloat(rgbe, i)
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (l < min) min = l
    if (l > max) max = l
    sum += l
  }
  console.log(`  luminance  min ${min.toFixed(4)}  mean ${(sum / (W * H)).toFixed(3)}  max ${max.toFixed(1)}`)
  console.log(`  dynamic range ${(max / Math.max(min, 1e-6)).toFixed(0)}:1`)

  fs.mkdirSync(OUT, { recursive: true })

  // Reinhard-ish tone map at several exposures — the bright end only becomes
  // visible when you stop down, which is the whole point of storing HDR.
  const exposures = [1, 0.25, 0.06]
  const strips = []
  for (const ev of exposures) {
    const px = Buffer.alloc(W * H * 3)
    for (let i = 0, p = 0; i < W * H * 4; i += 4, p += 3) {
      const c = toFloat(rgbe, i)
      for (let k = 0; k < 3; k++) {
        const v = c[k] * ev
        px[p + k] = Math.round(255 * Math.pow(v / (1 + v), 1 / 2.2))
      }
    }
    strips.push(await sharp(px, { raw: { width: W, height: H, channels: 3 } })
      .resize(700, null, { fit: 'inside' }).png().toBuffer())
  }

  const meta = await sharp(strips[0]).metadata()
  await sharp({ create: { width: meta.width, height: meta.height * strips.length, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite(strips.map((s, i) => ({ input: s, left: 0, top: i * meta.height })))
    .png()
    .toFile(path.join(OUT, 'showroom_exposures.png'))

  console.log(`  exposures ${exposures.join(', ')} -> ${path.join(OUT, 'showroom_exposures.png')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
