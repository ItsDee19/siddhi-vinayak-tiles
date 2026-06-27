// ---------------------------------------------------------------------------
// Procedural material textures, drawn on a <canvas>. This keeps the whole site
// self-contained (no external image downloads needed) while still giving each
// material — marble, granite, quartz, wood-look tile, ceramic, terrazzo — a
// believable surface for both the 3D scenes and the 2D gallery thumbnails.
//
// To swap in REAL shop photos later: in products.js give an item an `image`
// URL and the Gallery will use it directly instead of the procedural preview.
// ---------------------------------------------------------------------------

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
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`
}

function rng(seed) {
  // Tiny deterministic PRNG so a given material always looks the same.
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function seedFrom(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

// --- individual material painters -----------------------------------------

function paintBase(ctx, size, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
}

function paintMarble(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  // soft cloudy blotches
  for (let i = 0; i < 18; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = (0.1 + rand() * 0.35) * size
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, shade(color, -10 + rand() * 20))
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  // flowing veins
  const veinCount = 5 + Math.floor(rand() * 4)
  for (let v = 0; v < veinCount; v++) {
    ctx.beginPath()
    let x = rand() * size
    let y = 0
    ctx.moveTo(x, y)
    const steps = 9
    for (let s = 1; s <= steps; s++) {
      const nx = x + (rand() - 0.5) * size * 0.4
      const ny = (size / steps) * s
      const cx = (x + nx) / 2 + (rand() - 0.5) * size * 0.25
      const cy = (y + ny) / 2
      ctx.quadraticCurveTo(cx, cy, nx, ny)
      x = nx
      y = ny
    }
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.25 + rand() * 0.4
    ctx.lineWidth = 0.6 + rand() * 2.4
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function paintGranite(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  const dots = size * size * 0.06
  for (let i = 0; i < dots; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = rand() * 1.8
    const t = rand()
    ctx.fillStyle =
      t < 0.5 ? shade(color, -35 - rand() * 35) : t < 0.8 ? shade(color, 30 + rand() * 30) : accent
    ctx.globalAlpha = 0.5 + rand() * 0.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function paintQuartz(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  // gentle wide bands
  for (let i = 0; i < 6; i++) {
    const g = ctx.createLinearGradient(0, rand() * size, size, rand() * size)
    g.addColorStop(0, 'transparent')
    g.addColorStop(0.5, shade(color, -6))
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  // fine sparkle
  const dots = size * size * 0.03
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = rand() < 0.7 ? shade(color, -20) : accent
    ctx.globalAlpha = 0.3 + rand() * 0.5
    ctx.fillRect(rand() * size, rand() * size, 1, 1)
  }
  ctx.globalAlpha = 1
}

function paintWood(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  // horizontal plank grain
  const planks = 4
  for (let p = 0; p < planks; p++) {
    const y0 = (size / planks) * p
    ctx.fillStyle = shade(color, -8 - p * 2)
    ctx.fillRect(0, y0, size, 1.5) // grout/plank seam
    for (let g = 0; g < 22; g++) {
      ctx.beginPath()
      const yy = y0 + 6 + rand() * (size / planks - 10)
      ctx.moveTo(0, yy)
      for (let x = 0; x <= size; x += size / 10) {
        ctx.lineTo(x, yy + Math.sin(x * 0.05 + p) * 1.6 + (rand() - 0.5) * 1.2)
      }
      ctx.strokeStyle = shade(color, -18 + rand() * 14)
      ctx.globalAlpha = 0.15 + rand() * 0.25
      ctx.lineWidth = 0.6 + rand()
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function paintCeramic(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  // soft vignette + faint speckle for a matte ceramic feel
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75)
  g.addColorStop(0, shade(color, 8))
  g.addColorStop(1, shade(color, -12))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size * 4; i++) {
    ctx.fillStyle = shade(color, -10)
    ctx.globalAlpha = 0.05 + rand() * 0.05
    ctx.fillRect(rand() * size, rand() * size, 1, 1)
  }
  ctx.globalAlpha = 1
}

function paintTerrazzo(ctx, size, color, accent, rand) {
  paintBase(ctx, size, color)
  const chips = size * 1.2
  const palette = [accent, shade(color, -40), shade(color, 30), shade('#b08d4f', 0), shade('#b5613f', 0)]
  for (let i = 0; i < chips; i++) {
    ctx.save()
    ctx.translate(rand() * size, rand() * size)
    ctx.rotate(rand() * Math.PI)
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)]
    ctx.globalAlpha = 0.55 + rand() * 0.4
    const w = 2 + rand() * 7
    const h = 2 + rand() * 7
    ctx.beginPath()
    ctx.moveTo(-w, 0)
    ctx.lineTo(0, -h)
    ctx.lineTo(w, 0)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

const PAINTERS = {
  marble: paintMarble,
  granite: paintGranite,
  quartz: paintQuartz,
  wood: paintWood,
  ceramic: paintCeramic,
  terrazzo: paintTerrazzo,
}

/**
 * Draw a material to a fresh canvas and return the element.
 * @param {object} opts { type, color, accent, size, seed }
 */
export function makeMaterialCanvas({
  type = 'marble',
  color = '#e7dcc9',
  accent = '#8a6d39',
  size = 512,
  seed = type + color,
} = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const rand = rng(typeof seed === 'number' ? seed : seedFrom(seed))
  const painter = PAINTERS[type] || paintMarble
  painter(ctx, size, color, accent, rand)
  return canvas
}

/** Return a data-URL preview (used by 2D gallery thumbnails). */
export function makeMaterialDataURL(opts) {
  return makeMaterialCanvas(opts).toDataURL('image/png')
}
