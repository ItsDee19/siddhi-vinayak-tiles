import { resolveZoneSource } from '../../utils/threeTextures'
import { loadImage } from './loadImage'

const imageCache = new Map()

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

/** Parse "600×1200mm" / "600x1200" → major edge length in mm, or null. */
function parseMajorMM(sizeStr) {
  if (!sizeStr) return null
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return null
  return Math.max(parseFloat(m[1]), parseFloat(m[2]))
}

/**
 * Convert a grayscale mask (white = paint zone) into a proper alpha mask.
 * Dilates slightly so hairline gaps at mask edges do not leave white seams.
 */
function maskToAlphaCanvas(maskImg, width, height, dilatePx = 1.5) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskImg, 0, 0, width, height)

  // Soft dilate: redraw mask slightly larger so thin black cracks close.
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
    // Luminance → alpha. Pure white keeps tile; pure black clears.
    const a = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0
    d[i] = 255
    d[i + 1] = 255
    d[i + 2] = 255
    d[i + 3] = a
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/**
 * Tile a seamless texture across the full canvas using createPattern
 * (no white gutters between cells).
 *
 * tileScale: 1 = default density; higher = larger tiles; lower = finer mosaic.
 * productSize: catalogue size string used for physical scale when present.
 * roomWidthMM: approximate real-world width of the photo room.
 */
function buildTiledLayer(width, height, tileImg, product, tileScale = 1, roomWidthMM = 3600) {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = layer.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const majorMM = parseMajorMM(product?.size) || 600
  // How many major tile edges fit across the room width.
  const tilesAcross = Math.max(2.5, (roomWidthMM / majorMM) / Math.max(0.35, tileScale))
  const tileW = width / tilesAcross
  const aspect =
    (product?.aspect > 0 && product.aspect) ||
    (tileImg.naturalWidth / Math.max(1, tileImg.naturalHeight))
  const tileH = tileW / aspect

  // Draw tile into a cell-sized canvas so createPattern tiles cleanly.
  const cell = document.createElement('canvas')
  // Use integer pixel sizes ≥ 32 to avoid degenerate patterns.
  cell.width = Math.max(32, Math.round(tileW))
  cell.height = Math.max(32, Math.round(tileH))
  const cctx = cell.getContext('2d')
  cctx.imageSmoothingEnabled = true
  cctx.imageSmoothingQuality = 'high'
  cctx.drawImage(tileImg, 0, 0, cell.width, cell.height)

  const pattern = ctx.createPattern(cell, 'repeat')
  if (!pattern) {
    // Fallback: manual loop (should rarely hit)
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

/**
 * Clip a full-frame layer to the zone mask (white regions kept).
 */
function applyMask(layerCanvas, alphaMaskCanvas) {
  const ctx = layerCanvas.getContext('2d')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(alphaMaskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return layerCanvas
}

/**
 * Multiply tile albedo by base-photo luminance so contact shadows / ambient
 * occlusion from the lifestyle shot survive the material swap.
 */
function bakeLighting(tileLayer, baseImg, width, height) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Draw tiles
  ctx.drawImage(tileLayer, 0, 0)

  // Sample base into temp
  const baseC = document.createElement('canvas')
  baseC.width = width
  baseC.height = height
  const bctx = baseC.getContext('2d', { willReadFrequently: true })
  bctx.drawImage(baseImg, 0, 0, width, height)

  const tileData = ctx.getImageData(0, 0, width, height)
  const baseData = bctx.getImageData(0, 0, width, height)
  const td = tileData.data
  const bd = baseData.data

  for (let i = 0; i < td.length; i += 4) {
    const a = td[i + 3]
    if (a < 2) continue
    // Soft lighting: lift midtones so tiles stay bright but pick up shadows.
    const lum = (0.299 * bd[i] + 0.587 * bd[i + 1] + 0.114 * bd[i + 2]) / 255
    // Map luminance into 0.55–1.15 so dark corners darken tiles without mud.
    const light = 0.55 + lum * 0.6
    td[i] = Math.min(255, td[i] * light)
    td[i + 1] = Math.min(255, td[i + 1] * light)
    td[i + 2] = Math.min(255, td[i + 2] * light)
  }
  ctx.putImageData(tileData, 0, 0)
  return out
}

/**
 * Resolve the same seamless tile URL the 3D visualizer uses.
 * Never fall back to catalogue product photos (those have white packaging
 * backgrounds and caused the grid-of-swatches look).
 */
function resolveTextureUrl(product) {
  if (!product) return null

  // Custom upload — use the blob URL as a seamless face.
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

  // Same processed seamless tile the 3D visualizer uses (never raw catalogue photos).
  const source = resolveZoneSource(product, 'full')
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

  // Procedural / missing pipeline texture — refuse to paint brochure photos.
  return null
}

/**
 * Compose the 2D room onto a canvas at high quality:
 * base → masked seamless tile layers (with lighting) → locked fixture overlay.
 */
export async function composeRoom(canvas, room, zoneTextures = {}, opts = {}) {
  const {
    tileScale = 1,
    // Keep near-native resolution for crisp tiles (source is 3344px wide).
    maxWidth = 2800,
    roomWidthMM = 3600,
  } = opts
  if (!canvas || !room) return { ok: false, errors: ['No canvas/room'] }

  const base = await cachedImage(room.baseUrl)
  const nativeW = base.naturalWidth
  const nativeH = base.naturalHeight
  const scale = Math.min(1, maxWidth / nativeW)
  const w = Math.round(nativeW * scale)
  const h = Math.round(nativeH * scale)

  // Reset backing store (clears previous frame completely).
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

    const resolved = resolveTextureUrl(product)
    const texUrl = typeof resolved === 'string' ? resolved : resolved?.url
    if (!texUrl) {
      errors.push(
        `${zone.id}: “${product.name || product.id}” has no seamless tile texture (catalogue photo blocked)`,
      )
      continue
    }

    const meta = typeof resolved === 'object' && resolved ? resolved : product

    try {
      const [tileImg, maskImg] = await Promise.all([
        cachedImage(texUrl),
        cachedImage(zone.maskUrl),
      ])
      if (!tileImg || !maskImg) {
        errors.push(`${zone.id}: failed to load tile or mask image`)
        continue
      }

      let layer = buildTiledLayer(w, h, tileImg, meta, tileScale, roomWidthMM)
      const alphaMask = maskToAlphaCanvas(maskImg, w, h, 1.25)
      layer = applyMask(layer, alphaMask)
      layer = bakeLighting(layer, base, w, h)
      ctx.drawImage(layer, 0, 0)
    } catch (err) {
      console.warn(`[2D visualizer] zone ${zone.id} failed:`, err)
      errors.push(`${zone.id}: ${err?.message || 'compose failed'}`)
    }
  }

  if (room.overlayUrl) {
    try {
      const overlay = await cachedImage(room.overlayUrl)
      if (overlay) {
        ctx.drawImage(overlay, 0, 0, w, h)
      }
    } catch (err) {
      console.warn('[2D visualizer] overlay failed:', err)
      errors.push(`overlay: ${err?.message || 'failed'}`)
    }
  }

  return { ok: errors.length === 0, errors, width: w, height: h }
}
