import { resolveZoneSource } from '../../utils/threeTextures'
import { tileUrl2d } from '../../data/tileQuality2d'
import { loadImage } from './loadImage'

const imageCache = new Map()
// Layer cache: zone+product+scale+dims → pre-lit masked canvas
const layerCache = new Map()
// Mask alpha cache: maskUrl+w+h → alpha canvas
const maskCache = new Map()
// Base luminance buffer cache: baseUrl+w+h → Float32Array of lum 0..1
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

function maskToAlphaCanvas(maskImg, width, height, dilatePx = 1.25) {
  const key = `${maskImg.src || maskImg}|${width}x${height}|${dilatePx}`
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
    const offsets = [
      [dilatePx, 0], [-dilatePx, 0], [0, dilatePx], [0, -dilatePx],
      [dilatePx, dilatePx], [-dilatePx, dilatePx], [dilatePx, -dilatePx], [-dilatePx, -dilatePx],
    ]
    for (const [ox, oy] of offsets) {
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
  maskCache.set(key, c)
  return c
}

function getBaseLuminance(baseImg, width, height) {
  const key = `${baseImg.src || 'base'}|${width}x${height}`
  if (lumCache.has(key)) return lumCache.get(key)

  const baseC = document.createElement('canvas')
  baseC.width = width
  baseC.height = height
  const bctx = baseC.getContext('2d', { willReadFrequently: true })
  bctx.drawImage(baseImg, 0, 0, width, height)
  const data = bctx.getImageData(0, 0, width, height).data
  const lum = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
  }
  lumCache.set(key, lum)
  return lum
}

function buildTiledLayer(width, height, tileImg, product, tileScale = 1, roomWidthMM = 3600) {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = layer.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const majorMM = parseMajorMM(product?.size) || 600
  const tilesAcross = Math.max(2.5, (roomWidthMM / majorMM) / Math.max(0.35, tileScale))
  const tileW = width / tilesAcross
  const aspect =
    (product?.aspect > 0 && product.aspect) ||
    (tileImg.naturalWidth / Math.max(1, tileImg.naturalHeight))
  const tileH = tileW / aspect

  const cell = document.createElement('canvas')
  cell.width = Math.max(32, Math.round(tileW))
  cell.height = Math.max(32, Math.round(tileH))
  const cctx = cell.getContext('2d')
  cctx.imageSmoothingEnabled = true
  cctx.imageSmoothingQuality = 'high'
  cctx.drawImage(tileImg, 0, 0, cell.width, cell.height)

  const pattern = ctx.createPattern(cell, 'repeat')
  if (!pattern) {
    for (let y = 0; y < height + cell.height; y += cell.height) {
      for (let x = 0; x < width + cell.width; x += cell.width) {
        ctx.drawImage(cell, x, y)
      }
    }
    return layer
  }
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  return layer
}

function applyMask(layerCanvas, alphaMaskCanvas) {
  const ctx = layerCanvas.getContext('2d')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alphaMaskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return layerCanvas
}

function bakeLighting(tileLayer, lum, width, height) {
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
    const light = 0.55 + lum[p] * 0.6
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

  // Prefer 2d tier helper; fall back to shared 3D resolver.
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

function layerCacheKey(zoneId, product, tileScale, w, h, tier) {
  const id = product?.id || product?.url || 'none'
  return `${zoneId}|${id}|${tileScale}|${w}x${h}|${tier}`
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
}) {
  const resolved = resolveTextureUrl(product, tier)
  const texUrl = resolved?.url
  if (!texUrl) {
    return { layer: null, error: `“${product?.name || product?.id}” has no seamless tile` }
  }

  const cacheKey = layerCacheKey(zone.id, product, tileScale, width, height, tier)
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

  let layer = buildTiledLayer(width, height, tileImg, resolved, tileScale, roomWidthMM)
  const alphaMask = maskToAlphaCanvas(maskImg, width, height, 1.25)
  layer = applyMask(layer, alphaMask)
  const lum = getBaseLuminance(baseImg, width, height)
  layer = bakeLighting(layer, lum, width, height)

  layerCache.set(cacheKey, layer)
  // Bound cache growth (keep last ~24 zone layers).
  if (layerCache.size > 24) {
    const first = layerCache.keys().next().value
    layerCache.delete(first)
  }
  return { layer, error: null }
}

/**
 * Compose the 2D room.
 * @param {object} opts.dirtyZones - if set, only rebuild these zone ids (others reused from cache)
 * @param {string} opts.tier - 'lite' | 'full'
 * @param {number} opts.maxWidth
 */
export async function composeRoom(canvas, room, zoneTextures = {}, opts = {}) {
  const {
    tileScale = 1,
    maxWidth = 1800,
    roomWidthMM = room?.roomWidthMM || 3600,
    tier = 'full',
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

/** Full-resolution export for Download (uses full tier + native-ish width). */
export async function composeRoomExport(canvas, room, zoneTextures, opts = {}) {
  return composeRoom(canvas, room, zoneTextures, {
    ...opts,
    tier: 'full',
    maxWidth: opts.maxWidth ?? 3344,
  })
}
