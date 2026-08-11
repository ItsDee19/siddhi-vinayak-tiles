/**
 * Unified size-calculator catalogue from all five PDF extract seeds.
 * Used by the Size Calculator UI only — does not replace importedCatalogue.
 */
import floorSeed from './floorSizeCalculator.json'
import wallSeed from './wallSizeCalculator.json'
import sunfloraSeed from './sunfloraSizeCalculator.json'
import skySeed from './sky12x18SizeCalculator.json'
import skypeSeed from './skypeSizeCalculator.json'

function normalizeSize(sizeMm) {
  if (!sizeMm) return ''
  return String(sizeMm)
    .replace(/x/gi, '×')
    .replace(/\s+/g, '')
    .replace(/mm$/i, 'mm')
}

function parseMm(sizeMm) {
  const n = normalizeSize(sizeMm)
  const m = n.match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/)
  if (!m) return null
  return { w: Number(m[1]), h: Number(m[2]) }
}

function mapProduct(p, collection, surfaceDefault) {
  const sizeMm = normalizeSize(p.sizeMm || p.size || '')
  if (!sizeMm) return null
  const dims = parseMm(sizeMm)
  const surface = p.surface || surfaceDefault || 'Floor'
  const confidence = p.confidence || (p.ocrOk === false ? 'placeholder' : 'high')
  if (confidence === 'non_product') return null

  return {
    id: p.id,
    name: p.name || p.id,
    sizeMm,
    sizeIn: p.sizeIn || p.sizeFt || null,
    finish: p.finish || '',
    surface,
    collection,
    pcsPerBox: p.pcsPerBox != null && p.pcsPerBox !== '' ? Number(p.pcsPerBox) : null,
    boxWeightKg: p.boxWeightKg != null && p.boxWeightKg !== '' ? Number(p.boxWeightKg) : null,
    coverageSqFt: p.coverageSqFt != null && p.coverageSqFt !== '' ? Number(p.coverageSqFt) : null,
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'placeholder',
    textureUrl: p.textureUrl || null,
    widthMm: dims?.w ?? null,
    heightMm: dims?.h ?? null,
  }
}

function fromSeed(seed, collection, surfaceDefault) {
  return (seed.products || [])
    .map((p) => mapProduct(p, collection, surfaceDefault))
    .filter(Boolean)
}

/** All calculator-ready products */
export const sizeCalculatorProducts = [
  ...fromSeed(floorSeed, 'Global Floor', 'Floor'),
  ...fromSeed(wallSeed, 'Global Wall', 'Wall'),
  ...fromSeed(sunfloraSeed, 'Sunflora 2×4', 'Floor & Wall'),
  ...fromSeed(skySeed, 'Sky 12×18', 'Wall'),
  ...fromSeed(skypeSeed, 'Skype 2×4', 'Floor & Wall'),
]

/** Unique sizes with product counts */
export const sizeOptions = (() => {
  const map = new Map()
  for (const p of sizeCalculatorProducts) {
    if (!p.sizeMm) continue
    const cur = map.get(p.sizeMm) || { sizeMm: p.sizeMm, count: 0, surfaces: new Set() }
    cur.count += 1
    String(p.surface)
      .split(/[&,/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => cur.surfaces.add(s))
    map.set(p.sizeMm, cur)
  }
  return [...map.values()]
    .map((s) => ({
      sizeMm: s.sizeMm,
      count: s.count,
      surfaces: [...s.surfaces],
    }))
    .sort((a, b) => {
      const da = parseMm(a.sizeMm)
      const db = parseMm(b.sizeMm)
      const aa = da ? da.w * da.h : 0
      const bb = db ? db.w * db.h : 0
      return aa - bb || a.sizeMm.localeCompare(b.sizeMm)
    })
})()

export const collections = [
  { id: 'all', label: 'All collections' },
  { id: 'Global Floor', label: 'Global Floor' },
  { id: 'Global Wall', label: 'Global Wall' },
  { id: 'Sunflora 2×4', label: 'Sunflora 2×4' },
  { id: 'Sky 12×18', label: 'Sky 12×18' },
  { id: 'Skype 2×4', label: 'Skype 2×4' },
]

/**
 * Estimate tiles + boxes for a rectangular area.
 * @param {{ lengthFt: number, widthFt: number, sizeMm: string, wastePct?: number, pcsPerBox?: number|null, coverageSqFt?: number|null }} opts
 */
export function calculateTiles({
  lengthFt,
  widthFt,
  sizeMm,
  wastePct = 10,
  pcsPerBox = null,
  coverageSqFt = null,
}) {
  const dims = parseMm(sizeMm)
  if (!dims || !lengthFt || !widthFt || lengthFt <= 0 || widthFt <= 0) {
    return null
  }

  const areaSqFt = lengthFt * widthFt
  const tileWft = dims.w / 304.8
  const tileHft = dims.h / 304.8
  const tileAreaSqFt = tileWft * tileHft
  if (tileAreaSqFt <= 0) return null

  const rawTiles = areaSqFt / tileAreaSqFt
  const withWaste = rawTiles * (1 + wastePct / 100)
  const tilesNeeded = Math.ceil(withWaste)

  let boxes = null
  if (pcsPerBox && pcsPerBox > 0) {
    boxes = Math.ceil(tilesNeeded / pcsPerBox)
  } else if (coverageSqFt && coverageSqFt > 0) {
    boxes = Math.ceil((areaSqFt * (1 + wastePct / 100)) / coverageSqFt)
  }

  return {
    areaSqFt: Math.round(areaSqFt * 100) / 100,
    tileAreaSqFt: Math.round(tileAreaSqFt * 1000) / 1000,
    rawTiles: Math.ceil(rawTiles),
    tilesNeeded,
    wastePct,
    boxes,
    pcsPerBox: pcsPerBox || null,
    sizeMm: normalizeSize(sizeMm),
    tileWft: Math.round(tileWft * 1000) / 1000,
    tileHft: Math.round(tileHft * 1000) / 1000,
  }
}

export { normalizeSize, parseMm }
