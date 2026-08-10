import { resolveZoneSource } from '../../utils/threeTextures'
import { tileUrl2d } from '../../data/tileQuality2d'
import { loadImage } from './loadImage'
import {
  inverseBilinear,
  quadToPixels,
  quadBBox,
  samplePattern,
} from './perspective'

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

function parseMinorMM(sizeStr) {
  if (!sizeStr) return null
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return null
  return Math.min(parseFloat(m[1]), parseFloat(m[2]))
}

/** Soften mask edges so tiles blend into the photo without hard cutouts. */
function featherAlpha(canvas, radius) {
  if (radius <= 0) return canvas
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const src = ctx.getImageData(0, 0, w, h)
  const a = new Float32Array(w * h)
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) a[p] = src.data[i + 3]

  const r = Math.max(1, Math.round(radius))
  // Separable box blur on alpha.
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

function maskToAlphaCanvas(maskImg, width, height, dilatePx = 1.25, featherPx = 2) {
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
      [o, o], [-o, o], [o, -o], [-o, -o],
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

/**
 * Luminance + soft ambient occlusion boost (dark contact regions under vanity).
 * Returns Float32Array length w*h of lighting multipliers ~0.4–1.2
 */
function getLightingField(baseImg, width, height) {
  const key = `${baseImg.src || 'base'}|${width}x${height}|v2`
  if (lumCache.has(key)) return lumCache.get(key)

  const baseC = document.createElement('canvas')
  baseC.width = width
  baseC.height = height
  const bctx = baseC.getContext('2d', { willReadFrequently: true })
  bctx.drawImage(baseImg, 0, 0, width, height)
  const data = bctx.getImageData(0, 0, width, height).data
  const field = new Float32Array(width * height)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    // Soft AO: push dark areas darker (contact shadows), keep mids open.
    const ao = Math.pow(lum, 0.85)
    field[p] = 0.42 + ao * 0.78
  }
  lumCache.set(key, field)
  return field
}

/**
 * Build one tile cell (with optional grout border) used as the pattern atlas.
 */
function buildTileCell(tileImg, product, cellW, cellH, grout) {
  const cell = document.createElement('canvas')
  cell.width = Math.max(32, cellW)
  cell.height = Math.max(32, cellH)
  const ctx = cell.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const gw = grout?.enabled
    ? Math.max(1, Math.round(Math.min(cell.width, cell.height) * ((grout.mm || 2.5) / 120)))
    : 0
  const gcol = grout?.color || '#d4cdc0'

  if (gw > 0) {
    ctx.fillStyle = gcol
    ctx.fillRect(0, 0, cell.width, cell.height)
  }

  // Slight inset so grout shows; face fill.
  ctx.drawImage(
    tileImg,
    gw,
    gw,
    cell.width - gw * 2,
    cell.height - gw * 2,
  )

  // Finish cue: glossy = subtle top highlight strip; matte = flatten a touch.
  const finish = String(product?.finish || '').toLowerCase()
  if (finish.includes('gloss') || finish.includes('polish')) {
    const grad = ctx.createLinearGradient(0, gw, 0, cell.height * 0.45)
    grad.addColorStop(0, 'rgba(255,255,255,0.14)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(gw, gw, cell.width - gw * 2, (cell.height - gw * 2) * 0.45)
  } else if (finish.includes('matte') || finish.includes('matt')) {
    ctx.fillStyle = 'rgba(0,0,0,0.04)'
    ctx.fillRect(gw, gw, cell.width - gw * 2, cell.height - gw * 2)
  }

  return cell
}

/**
 * Perspective-correct tile fill for a zone plane, then clip with mask.
 */
function buildPerspectiveZoneLayer({
  width,
  height,
  tileImg,
  product,
  zone,
  tileScale,
  room,
  grout,
}) {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = layer.getContext('2d', { willReadFrequently: true })

  const majorMM = parseMajorMM(product?.size) || 600
  const minorMM = parseMinorMM(product?.size) || majorMM
  const aspect =
    (product?.aspect > 0 && product.aspect) ||
    (tileImg.naturalWidth / Math.max(1, tileImg.naturalHeight)) ||
    majorMM / minorMM

  const tilesAcross = Math.max(
    2.2,
    ((zone.tilesAcrossNear || 6) * (600 / majorMM)) / Math.max(0.35, tileScale),
  )
  // V tiles: scale by aspect so rectangles stay correct on the plane.
  const tilesDown = Math.max(1.5, tilesAcross / aspect)

  // Pattern cell resolution — larger for full quality, enough for sharp sampling.
  const cellW = Math.max(64, Math.min(512, Math.round(width / tilesAcross)))
  const cellH = Math.max(64, Math.min(512, Math.round(cellW / aspect)))
  const cell = buildTileCell(tileImg, product, cellW, cellH, grout)
  const pctx = cell.getContext('2d', { willReadFrequently: true })
  const pat = pctx.getImageData(0, 0, cell.width, cell.height)
  const patW = cell.width
  const patH = cell.height
  const patData = pat.data

  if (zone.quad && zone.quad.length === 4) {
    const corners = quadToPixels(zone.quad, width, height)
    const box = quadBBox(corners)
    const x0 = Math.max(0, box.x0)
    const y0 = Math.max(0, box.y0)
    const x1 = Math.min(width, box.x1)
    const y1 = Math.min(height, box.y1)

    const out = ctx.createImageData(width, height)
    const od = out.data

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const uv = inverseBilinear(x + 0.5, y + 0.5, corners)
        if (!uv) continue
        const [u, v] = uv
        const [r, g, b] = samplePattern(patData, patW, patH, u, v, tilesAcross, tilesDown)
        const i = (y * width + x) * 4
        od[i] = r
        od[i + 1] = g
        od[i + 2] = b
        od[i + 3] = 255
      }
    }
    ctx.putImageData(out, 0, 0)
  } else {
    // Fallback: orthogonal createPattern fill
    const pattern = ctx.createPattern(cell, 'repeat')
    ctx.fillStyle = pattern || '#ccc'
    ctx.fillRect(0, 0, width, height)
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
  return `${zoneId}|${id}|${tileScale}|${w}x${h}|${tier}|g${groutOn ? 1 : 0}`
}

async function buildZoneLayer({
  zone,
  product,
  baseImg,
  width,
  height,
  tileScale,
  room,
  tier,
  grout,
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

  const feather = (room.maskFeatherPx || 2.5) * (width / 1600)
  let layer = buildPerspectiveZoneLayer({
    width,
    height,
    tileImg,
    product: resolved,
    zone,
    tileScale,
    room,
    grout,
  })
  const alphaMask = maskToAlphaCanvas(maskImg, width, height, 1.25, feather)
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
    groutEnabled,
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
    ...(room.grout || {}),
    enabled:
      typeof groutEnabled === 'boolean'
        ? groutEnabled
        : room.grout?.enabled !== false,
  }

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
        room: { ...room, roomWidthMM },
        tier,
        grout,
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
