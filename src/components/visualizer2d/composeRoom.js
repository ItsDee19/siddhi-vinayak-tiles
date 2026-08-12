import { resolveZoneSource } from '../../utils/tileSource'
import { tileUrl2d } from '../../data/tileQuality2d'
import { loadImage } from './loadImage'

/**
 * 2D room compositor — mask + fill + overlay with realism extras:
 *  - Seamless createPattern (stable default)
 *  - Optional floor/wall perspective quad (homography grid warp)
 *  - Luminance multiply from base.png (room light/shadow recovery)
 *  - Soft mask feather (no fake per-cell grid lines)
 *
 * Perspective is opt-in via zone.perspectiveQuad (normalized 0–1 corners).
 * Flat tiling remains default so rooms without quads stay stable.
 */

const imageCache = new Map()
const layerCache = new Map()
const maskCache = new Map()
const lumCanvasCache = new Map()

async function cachedImage(src) {
  if (!src) return null
  if (imageCache.has(src)) return imageCache.get(src)
  const p = loadImage(src).catch((err) => {
    imageCache.delete(src)
    throw err
  })
  imageCache.set(src, p)
  return p
}

function parseMajorMM(sizeStr) {
  if (!sizeStr) return null
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return null
  return Math.max(parseFloat(m[1]), parseFloat(m[2]))
}

function featherAlpha(canvas, radius) {
  if (radius <= 0) return canvas
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const src = ctx.getImageData(0, 0, w, h)
  const a = new Float32Array(w * h)
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) a[p] = src.data[i + 3]

  const r = Math.max(1, Math.round(radius))
  const tmp = new Float32Array(w * h)
  const pass = (inp, out, horizontal) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let n = 0
        if (horizontal) {
          for (let k = -r; k <= r; k++) {
            const xx = x + k
            if (xx < 0 || xx >= w) continue
            sum += inp[y * w + xx]
            n++
          }
        } else {
          for (let k = -r; k <= r; k++) {
            const yy = y + k
            if (yy < 0 || yy >= h) continue
            sum += inp[yy * w + x]
            n++
          }
        }
        out[y * w + x] = sum / Math.max(1, n)
      }
    }
  }
  pass(a, tmp, true)
  pass(tmp, a, false)

  const out = ctx.createImageData(w, h)
  for (let i = 0, p = 0; i < out.data.length; i += 4, p++) {
    out.data[i] = 255
    out.data[i + 1] = 255
    out.data[i + 2] = 255
    out.data[i + 3] = Math.min(255, Math.max(0, a[p] | 0))
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

function maskToAlphaCanvas(maskImg, width, height, dilatePx = 1, featherPx = 1.5) {
  const key = `${maskImg.src || 'm'}|${width}x${height}|${dilatePx}|${featherPx}|v2`
  if (maskCache.has(key)) return maskCache.get(key)

  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskImg, 0, 0, width, height)

  if (dilatePx > 0) {
    ctx.globalCompositeOperation = 'lighten'
    const o = dilatePx
    for (const [ox, oy] of [
      [o, 0], [-o, 0], [0, o], [0, -o],
    ]) {
      ctx.drawImage(maskImg, ox, oy, width, height)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  const img = ctx.getImageData(0, 0, width, height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const a = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0
    d[i] = 255
    d[i + 1] = 255
    d[i + 2] = 255
    d[i + 3] = a
  }
  ctx.putImageData(img, 0, 0)
  // Slightly stronger soft edge (anti-aliased borders)
  const scaledFeather = Math.max(1.2, featherPx * (width / 1400))
  featherAlpha(c, scaledFeather)
  maskCache.set(key, c)
  return c
}

/**
 * Grayscale lighting plate from base photo (mid-gray ≈ no change under multiply).
 * Soft blur preserves ambient gradients / window light without tile texture.
 */
function getLuminancePlate(baseImg, width, height) {
  const key = `${baseImg.src || 'base'}|${width}x${height}|lum-v4`
  if (lumCanvasCache.has(key)) return lumCanvasCache.get(key)

  const src = document.createElement('canvas')
  src.width = width
  src.height = height
  const sctx = src.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(baseImg, 0, 0, width, height)
  const data = sctx.getImageData(0, 0, width, height)
  const d = data.data

  // Convert to grayscale, center around mid-gray for multiply friendliness
  let sum = 0
  const n = width * height
  const gray = new Float32Array(n)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    gray[p] = g
    sum += g
  }
  const mean = sum / Math.max(1, n)

  // Soft plate: keep more contrast so step edges / soft shadows read on tiles
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = gray[p]
    // mean → ~0.68; stronger relative shade (less “sticker on top” look)
    const rel = (g - mean) * 1.15
    const v = Math.min(1, Math.max(0, 0.68 + rel))
    const byte = (v * 255) | 0
    d[i] = byte
    d[i + 1] = byte
    d[i + 2] = byte
    d[i + 3] = 255
  }
  sctx.putImageData(data, 0, 0)

  // Mild blur so tile pattern isn't fighting photo texture grain
  const plate = document.createElement('canvas')
  plate.width = width
  plate.height = height
  const pctx = plate.getContext('2d')
  pctx.filter = 'blur(0.9px)'
  pctx.drawImage(src, 0, 0)
  pctx.filter = 'none'

  lumCanvasCache.set(key, plate)
  return plate
}

/**
 * Apply room lighting: multiply grayscale base plate through the zone mask.
 * Restores soft window light / AO without wiping tile color entirely.
 */
function applyLuminanceMultiply(tileLayer, baseImg, alphaMask, width, height, strength = 0.72) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tileLayer, 0, 0)

  if (strength <= 0) return out

  const plate = getLuminancePlate(baseImg, width, height)

  // Clip plate to zone mask
  const plateMasked = document.createElement('canvas')
  plateMasked.width = width
  plateMasked.height = height
  const pm = plateMasked.getContext('2d')
  pm.drawImage(plate, 0, 0)
  pm.globalCompositeOperation = 'destination-in'
  pm.drawImage(alphaMask, 0, 0)
  pm.globalCompositeOperation = 'source-over'

  // Strength: mix pure white with plate so effect is tunable
  if (strength < 1) {
    const mix = document.createElement('canvas')
    mix.width = width
    mix.height = height
    const mx = mix.getContext('2d')
    mx.fillStyle = '#ffffff'
    mx.fillRect(0, 0, width, height)
    mx.globalAlpha = strength
    mx.drawImage(plateMasked, 0, 0)
    mx.globalAlpha = 1
    mx.globalCompositeOperation = 'destination-in'
    mx.drawImage(alphaMask, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(mix, 0, 0)
  } else {
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(plateMasked, 0, 0)
  }
  ctx.globalCompositeOperation = 'source-over'

  // Preserve original tile alpha
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alphaMask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return out
}

/**
 * Full-frame seamless tile fill (createPattern).
 * No per-cell vignette/bevel — those looked like translucent grid lines.
 * Optional grout only when user enables "Show fine grout lines".
 */
function buildSeamlessLayer(width, height, tileImg, product, tileScale, roomWidthMM, grout) {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = layer.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const majorMM = parseMajorMM(product?.size) || 600
  const tilesAcross = Math.max(4, (roomWidthMM / majorMM) / Math.max(0.4, tileScale))
  const tileW = width / tilesAcross
  const aspect =
    (product?.aspect > 0 && product.aspect) ||
    (tileImg.naturalWidth / Math.max(1, tileImg.naturalHeight)) ||
    1
  const tileH = tileW / aspect

  const cellW = Math.max(48, Math.round(tileW))
  const cellH = Math.max(48, Math.round(tileH))
  const cell = document.createElement('canvas')
  cell.width = cellW
  cell.height = cellH
  const cctx = cell.getContext('2d')
  cctx.imageSmoothingEnabled = true
  cctx.imageSmoothingQuality = 'high'

  const gw =
    grout?.enabled
      ? Math.max(1, Math.round(Math.min(cellW, cellH) * 0.012))
      : 0
  if (gw > 0) {
    cctx.fillStyle = grout.color || '#d4cdc0'
    cctx.fillRect(0, 0, cellW, cellH)
    cctx.drawImage(tileImg, gw, gw, cellW - gw * 2, cellH - gw * 2)
  } else {
    // Full-bleed cell — seamless pattern, no edge overlay
    cctx.drawImage(tileImg, 0, 0, cellW, cellH)
  }

  const pattern = ctx.createPattern(cell, 'repeat')
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)
  } else {
    for (let y = 0; y < height + cellH; y += cellH) {
      for (let x = 0; x < width + cellW; x += cellW) {
        ctx.drawImage(cell, x, y)
      }
    }
  }
  return layer
}

/**
 * Perspective grid warp: map unit square UV → destination quad.
 * quad: 4 points {x,y} in pixel space, order TL, TR, BR, BL.
 * Dense enough mesh for floors without OpenCV.js.
 */
function warpToQuad(srcCanvas, quad, width, height, grid = 24) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const [tl, tr, br, bl] = quad
  const lerp = (a, b, t) => a + (b - a) * t
  const bilinear = (u, v) => {
    const topX = lerp(tl.x, tr.x, u)
    const topY = lerp(tl.y, tr.y, u)
    const botX = lerp(bl.x, br.x, u)
    const botY = lerp(bl.y, br.y, u)
    return { x: lerp(topX, botX, v), y: lerp(topY, botY, v) }
  }

  const sw = srcCanvas.width
  const sh = srcCanvas.height

  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const u0 = i / grid
      const v0 = j / grid
      const u1 = (i + 1) / grid
      const v1 = (j + 1) / grid
      const p00 = bilinear(u0, v0)
      const p10 = bilinear(u1, v0)
      const p11 = bilinear(u1, v1)
      const p01 = bilinear(u0, v1)

      // Two triangles per cell — approximate affine warp
      drawTexturedTriangle(
        ctx,
        srcCanvas,
        { x: u0 * sw, y: v0 * sh },
        { x: u1 * sw, y: v0 * sh },
        { x: u1 * sw, y: v1 * sh },
        p00,
        p10,
        p11,
      )
      drawTexturedTriangle(
        ctx,
        srcCanvas,
        { x: u0 * sw, y: v0 * sh },
        { x: u1 * sw, y: v1 * sh },
        { x: u0 * sw, y: v1 * sh },
        p00,
        p11,
        p01,
      )
    }
  }
  return out
}

/**
 * Draw a textured triangle via affine transform (canvas setTransform).
 */
function drawTexturedTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
  // Solve affine: maps s → d for three points
  // https://stackoverflow.com/a/19689497
  const denom =
    s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y)
  if (Math.abs(denom) < 1e-6) return

  const m11 =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom
  const m12 =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom
  const m13 =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom
  const m21 =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom
  const m22 =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom
  const m23 =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(d0.x, d0.y)
  ctx.lineTo(d1.x, d1.y)
  ctx.lineTo(d2.x, d2.y)
  ctx.closePath()
  ctx.clip()
  ctx.setTransform(m11, m21, m12, m22, m13, m23)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/** Normalize zone.perspectiveQuad (0–1 corners) → pixel quad. */
function resolveQuad(zone, width, height) {
  const q = zone.perspectiveQuad
  if (!q || q.length !== 4) return null
  return q.map((p) => ({
    x: (Array.isArray(p) ? p[0] : p.x) * width,
    y: (Array.isArray(p) ? p[1] : p.y) * height,
  }))
}

function applyMask(layerCanvas, alphaMaskCanvas) {
  const ctx = layerCanvas.getContext('2d')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alphaMaskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return layerCanvas
}

function resolveTextureUrl(product, tier = 'full') {
  if (!product) return null

  if (product.isCustom && product.url) {
    return {
      url: product.url,
      aspect: product.aspect || 1,
      size: product.size || '600x600mm',
      finish: product.finish,
      id: product.id,
      name: product.name,
    }
  }

  const url2d = tileUrl2d(product, tier)
  if (url2d) {
    const source = resolveZoneSource(product, tier === 'lite' ? 'lite' : 'full')
    return {
      url: url2d,
      aspect: source?.aspect,
      size: product.size || source?.size,
      finish: product.finish || source?.finish,
      id: product.id,
      name: product.name,
    }
  }

  const source = resolveZoneSource(product, tier === 'lite' ? 'lite' : 'full')
  if (source?.url) {
    return {
      url: source.url,
      aspect: source.aspect,
      size: product.size || source.size,
      finish: product.finish || source.finish,
      id: product.id,
      name: product.name,
    }
  }
  return null
}

function layerCacheKey(zoneId, product, tileScale, w, h, tier, groutOn, hasPersp, lightStr) {
  const id = product?.id || product?.url || 'none'
  // bump suffix when lighting/scale bake changes so old cache entries are not reused
  return `${zoneId}|${id}|${tileScale}|${w}x${h}|${tier}|g${groutOn ? 1 : 0}|p${hasPersp ? 1 : 0}|L${lightStr}|r8`
}

async function buildZoneLayer({
  zone,
  product,
  baseImg,
  width,
  height,
  tileScale,
  roomWidthMM,
  tier,
  grout,
  featherPx,
  lightStrength,
}) {
  const resolved = resolveTextureUrl(product, tier)
  const texUrl = resolved?.url
  if (!texUrl) {
    return { layer: null, error: `“${product?.name || product?.id}” has no seamless tile` }
  }

  const quad = resolveQuad(zone, width, height)
  const cacheKey = layerCacheKey(
    zone.id,
    product,
    tileScale,
    width,
    height,
    tier,
    !!grout?.enabled,
    !!quad,
    lightStrength,
  )
  if (layerCache.has(cacheKey)) {
    return { layer: layerCache.get(cacheKey), error: null }
  }

  const [tileImg, maskImg] = await Promise.all([
    cachedImage(texUrl),
    cachedImage(zone.maskUrl),
  ])
  if (!tileImg || !maskImg) {
    return { layer: null, error: 'failed to load tile or mask' }
  }

  let layer = buildSeamlessLayer(
    width,
    height,
    tileImg,
    resolved,
    tileScale,
    roomWidthMM,
    grout,
  )

  // Optional perspective: warp full pattern into room plane quad (floors mostly)
  if (quad) {
    const grid = tier === 'lite' ? 14 : 28
    layer = warpToQuad(layer, quad, width, height, grid)
  }

  const alphaMask = maskToAlphaCanvas(maskImg, width, height, 1, featherPx)
  layer = applyMask(layer, alphaMask)
  layer = applyLuminanceMultiply(layer, baseImg, alphaMask, width, height, lightStrength)

  layerCache.set(cacheKey, layer)
  if (layerCache.size > 24) {
    const first = layerCache.keys().next().value
    layerCache.delete(first)
  }
  return { layer, error: null }
}

export async function composeRoom(canvas, room, zoneTextures = {}, opts = {}) {
  const {
    tileScale = 1,
    maxWidth = 1800,
    roomWidthMM = room?.roomWidthMM || 3600,
    tier = 'full',
    groutEnabled = false,
    lightStrength = room?.lightStrength ?? 0.72,
  } = opts

  if (!canvas || !room) return { ok: false, errors: ['No canvas/room'] }

  const base = await cachedImage(room.baseUrl)
  const nativeW = base.naturalWidth
  const nativeH = base.naturalHeight
  const scale = Math.min(1, maxWidth / nativeW)
  const w = Math.round(nativeW * scale)
  const h = Math.round(nativeH * scale)

  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(base, 0, 0, w, h)

  const grout = {
    color: room.grout?.color || '#d4cdc0',
    enabled: !!groutEnabled,
  }
  const featherPx = room.maskFeatherPx ?? 2.0

  const errors = []

  for (const zone of room.zones || []) {
    const product = zoneTextures[zone.id]
    if (!product) {
      errors.push(`${zone.id}: no product selected`)
      continue
    }
    if (!zone.maskUrl) {
      errors.push(`${zone.id}: missing mask`)
      continue
    }

    try {
      const { layer, error } = await buildZoneLayer({
        zone,
        product,
        baseImg: base,
        width: w,
        height: h,
        tileScale,
        roomWidthMM,
        tier,
        grout,
        featherPx,
        lightStrength,
      })
      if (error) {
        errors.push(`${zone.id}: ${error}`)
        continue
      }
      if (layer) ctx.drawImage(layer, 0, 0)
    } catch (err) {
      console.warn(`[2D visualizer] zone ${zone.id} failed:`, err)
      errors.push(`${zone.id}: ${err?.message || 'compose failed'}`)
    }
  }

  if (room.overlayUrl) {
    try {
      const overlay = await cachedImage(room.overlayUrl)
      if (overlay) ctx.drawImage(overlay, 0, 0, w, h)
    } catch (err) {
      errors.push(`overlay: ${err?.message || 'failed'}`)
    }
  }

  return { ok: errors.length === 0, errors, width: w, height: h, tier }
}

export async function composeRoomExport(canvas, room, zoneTextures, opts = {}) {
  return composeRoom(canvas, room, zoneTextures, {
    ...opts,
    tier: 'full',
    maxWidth: opts.maxWidth ?? 3344,
  })
}
