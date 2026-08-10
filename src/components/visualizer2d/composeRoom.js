import { resolveZoneSource } from '../../utils/threeTextures'
import { tileUrl2d } from '../../data/tileQuality2d'
import { loadImage } from './loadImage'

// Phase-1 style compositor (full-mask seamless createPattern) with quality extras:
// soft mask feather, AO lighting, optional fine grout.
// Perspective warps were removed as default — they left holes and partial bands
// on this near-frontal bathroom photo (worse than flat seamless tiling).

const imageCache = new Map()
const layerCache = new Map()
const maskCache = new Map()
const lumCache = new Map()

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
  const key = `${maskImg.src || 'm'}|${width}x${height}|${dilatePx}|${featherPx}`
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
  featherAlpha(c, featherPx * (width / 1600))
  maskCache.set(key, c)
  return c
}

function getLightingField(baseImg, width, height) {
  const key = `${baseImg.src || 'base'}|${width}x${height}|v3`
  if (lumCache.has(key)) return lumCache.get(key)

  const baseC = document.createElement('canvas')
  baseC.width = width
  baseC.height = height
  const bctx = baseC.getContext('2d', { willReadFrequently: true })
  bctx.drawImage(baseImg, 0, 0, width, height)
  const data = bctx.getImageData(0, 0, width, height).data
  const field = new Float32Array(width * height)

  // Gentle lighting — keep the clean look from Phase 1, only soft AO.
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    field[p] = 0.62 + lum * 0.48
  }
  lumCache.set(key, field)
  return field
}

/**
 * Full-frame seamless tile fill (createPattern) — covers the entire mask
 * continuously, matching the cleaner Phase-1 look.
 */
function buildSeamlessLayer(width, height, tileImg, product, tileScale, roomWidthMM, grout) {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = layer.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const majorMM = parseMajorMM(product?.size) || 600
  // Density: more tiles across the room = smaller, cleaner look.
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

  // Fine grout only (thin). Default off via grout.enabled.
  const gw =
    grout?.enabled
      ? Math.max(1, Math.round(Math.min(cellW, cellH) * 0.012))
      : 0
  if (gw > 0) {
    cctx.fillStyle = grout.color || '#d4cdc0'
    cctx.fillRect(0, 0, cellW, cellH)
    cctx.drawImage(tileImg, gw, gw, cellW - gw * 2, cellH - gw * 2)
  } else {
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

function applyMask(layerCanvas, alphaMaskCanvas) {
  const ctx = layerCanvas.getContext('2d')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alphaMaskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return layerCanvas
}

function bakeLighting(tileLayer, field, width, height) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tileLayer, 0, 0)

  const tileData = ctx.getImageData(0, 0, width, height)
  const td = tileData.data
  for (let i = 0, p = 0; i < td.length; i += 4, p++) {
    if (td[i + 3] < 2) continue
    const light = field[p]
    td[i] = Math.min(255, td[i] * light)
    td[i + 1] = Math.min(255, td[i + 1] * light)
    td[i + 2] = Math.min(255, td[i + 2] * light)
  }
  ctx.putImageData(tileData, 0, 0)
  return out
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

function layerCacheKey(zoneId, product, tileScale, w, h, tier, groutOn) {
  const id = product?.id || product?.url || 'none'
  return `${zoneId}|${id}|${tileScale}|${w}x${h}|${tier}|g${groutOn ? 1 : 0}|flat`
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
}) {
  const resolved = resolveTextureUrl(product, tier)
  const texUrl = resolved?.url
  if (!texUrl) {
    return { layer: null, error: `“${product?.name || product?.id}” has no seamless tile` }
  }

  const cacheKey = layerCacheKey(
    zone.id,
    product,
    tileScale,
    width,
    height,
    tier,
    !!grout?.enabled,
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
  const alphaMask = maskToAlphaCanvas(maskImg, width, height, 1, featherPx)
  layer = applyMask(layer, alphaMask)
  const field = getLightingField(baseImg, width, height)
  layer = bakeLighting(layer, field, width, height)

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
  const featherPx = room.maskFeatherPx ?? 1.5

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
