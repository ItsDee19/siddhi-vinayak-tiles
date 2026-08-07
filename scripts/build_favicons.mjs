// Regenerates the favicon set from public/logo-emblem.png.
//
//   node scripts/build_favicons.mjs
//
// Run this whenever the emblem changes so every icon size stays in sync
// instead of drifting apart by hand.
//
// Outputs:
//   public/favicon.ico          16/32/48, PNG-encoded inside an ICO container
//   public/favicon-32.png       crisp small size for browsers that pick it
//   public/favicon-192.png      standard PWA / Android icon
//   public/apple-touch-icon.png 180x180, flattened onto white
//
// sharp has no ICO encoder, so the container is written by hand below. That is
// well-defined and safe here: every icon directory entry simply points at a
// complete PNG, which Windows and every current browser accept.
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'public', 'logo-emblem.png')
const out = (name) => path.join(root, 'public', name)

// The emblem ships on a solid white background rather than a transparent one.
// Left as-is the icon reads as an orange disc inside a white box, which looks
// broken against a dark browser tab. The white cannot simply be keyed out
// because the glyph itself is white, so instead the artwork is masked to its
// own circle: everything outside becomes transparent, everything inside —
// including the white glyph — is untouched.
//
// The circle is measured from the artwork rather than hard-coded, so a redrawn
// emblem still masks correctly. (This assumes a circular mark; a future
// non-circular logo would want a different mask.)
// Crop the artwork down to the disc itself, discarding the white page around
// it. Returned square and full-bleed, so every icon size below is the emblem
// edge to edge with nothing wasted on margin — at 16px, a few pixels of
// padding is the difference between a legible mark and an orange smudge.
async function discSource() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      const isWhite = data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250
      if (isWhite) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const side = Math.max(maxX - minX, maxY - minY) + 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const left = Math.max(0, Math.min(info.width - side, Math.round(cx - side / 2)))
  const top = Math.max(0, Math.min(info.height - side, Math.round(cy - side / 2)))
  console.log(`  detected disc: ${side}x${side} at (${left}, ${top})`)
  return sharp(SRC).extract({ left, top, width: side, height: side }).png().toBuffer()
}

// A circle mask rendered AT the output size rather than downscaled from the
// source's own anti-aliased rim. Masking a shrunken 377px circle left a soft,
// ragged edge at small sizes; drawing the circle at 4x the target and
// minifying it gives a tight edge with clean anti-aliasing.
async function circleMask(size) {
  const S = size * 4
  const svg = Buffer.from(
    `<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`,
  )
  return sharp(svg).resize(size, size).png().toBuffer()
}

const png = async (src, size, background) => {
  let img = sharp(src).resize(size, size, { fit: 'fill' })
  // Downscaling 373px of artwork to 16 or 24 leaves the glyph strokes soft
  // enough to read as a blur. A light unsharp pass restores their edges; it is
  // skipped at larger sizes, where there is enough resolution not to need it
  // and the halo would be visible.
  if (size <= 48) img = img.sharpen({ sigma: 0.6 })

  let out = sharp(await img.png().toBuffer())
    .ensureAlpha()
    .composite([{ input: await circleMask(size), blend: 'dest-in' }])

  // iOS ignores transparency on the home screen and composites onto black,
  // so the touch icon is flattened onto white instead of shipping an alpha
  // channel that would render as a dark square behind the emblem.
  if (background) out = sharp(await out.png().toBuffer()).flatten({ background })

  return out.png({ compressionLevel: 9 }).toBuffer()
}

function buildIco(images) {
  const HEADER = 6
  const ENTRY = 16
  const header = Buffer.alloc(HEADER)
  header.writeUInt16LE(0, 0)              // reserved
  header.writeUInt16LE(1, 2)              // 1 = icon
  header.writeUInt16LE(images.length, 4)  // image count

  const entries = []
  let offset = HEADER + ENTRY * images.length
  for (const { size, data } of images) {
    const e = Buffer.alloc(ENTRY)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // 0 encodes 256
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)                      // palette size (0 = none)
    e.writeUInt8(0, 3)                      // reserved
    e.writeUInt16LE(1, 4)                   // colour planes
    e.writeUInt16LE(32, 6)                  // bits per pixel
    e.writeUInt32LE(data.length, 8)         // payload size
    e.writeUInt32LE(offset, 12)             // payload offset
    entries.push(e)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const meta = await sharp(SRC).metadata()
console.log(`source: logo-emblem.png ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`)

const disc = await discSource()

// 24 is included because Windows asks for it at 125% and 150% display scaling,
// which is the common desktop setup — without it the browser stretches the 16
// and the mark looks worse there than anywhere else.
const icoSizes = [16, 24, 32, 48]
const icoImages = []
for (const size of icoSizes) icoImages.push({ size, data: await png(disc, size) })
await writeFile(out('favicon.ico'), buildIco(icoImages))

await writeFile(out('favicon-32.png'), await png(disc, 32))
await writeFile(out('favicon-192.png'), await png(disc, 192))
await writeFile(out('apple-touch-icon.png'), await png(disc, 180, { r: 255, g: 255, b: 255, alpha: 1 }))

console.log(`wrote favicon.ico (${icoSizes.join('/')}), favicon-32.png, favicon-192.png, apple-touch-icon.png`)
