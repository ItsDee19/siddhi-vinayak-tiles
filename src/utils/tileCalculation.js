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
