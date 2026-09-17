const MM_PER_FOOT = 304.8

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return NaN
  return Number(value)
}

function roundUpTiles(value) {
  // Exact quantities such as 100 tiles + 10% must not become 111 through float noise.
  const nearestInteger = Math.round(value)
  const tolerance = Math.max(1, Math.abs(value)) * Number.EPSILON * 8
  return Math.abs(value - nearestInteger) <= tolerance ? nearestInteger : Math.ceil(value)
}

/** Area estimate only: no assumptions about stock, box packing, grout or tile layout. */
export function estimateTiles(values) {
  const errors = {}
  const parsed = {}
  for (const [name, label] of [
    ['lengthFt', 'room length'],
    ['widthFt', 'room width'],
    ['tileWidthMm', 'tile width'],
    ['tileHeightMm', 'tile height'],
  ]) {
    parsed[name] = numericValue(values[name])
    if (!Number.isFinite(parsed[name]) || parsed[name] <= 0) {
      errors[name] = `Enter a ${label} greater than zero.`
    }
  }

  parsed.wastePct = numericValue(values.wastePct)
  if (!Number.isFinite(parsed.wastePct) || parsed.wastePct < 0 || parsed.wastePct > 100) {
    errors.wastePct = 'Enter an allowance from 0 to 100%.'
  }
  if (Object.keys(errors).length) return { result: null, errors }

  const areaSqFt = parsed.lengthFt * parsed.widthFt
  const tileAreaSqFt = (parsed.tileWidthMm / MM_PER_FOOT) * (parsed.tileHeightMm / MM_PER_FOOT)
  const tilesNeeded = roundUpTiles(areaSqFt / tileAreaSqFt * (1 + parsed.wastePct / 100))
  if (!Number.isFinite(areaSqFt) || !Number.isSafeInteger(tilesNeeded) || tilesNeeded < 1) {
    return { result: null, errors: { lengthFt: 'Check the dimensions and units; this estimate is outside the supported range.' } }
  }

  return { result: { ...parsed, areaSqFt, tilesNeeded }, errors }
}
