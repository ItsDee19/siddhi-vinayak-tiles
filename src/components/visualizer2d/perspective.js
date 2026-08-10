// Inverse bilinear mapping for a convex quad (TL, TR, BR, BL).
// Perspective-warps seamless tile patterns onto wall/floor planes.
// Ref: https://www.particleincell.com/2012/quad-interpolation/

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<[number, number]>} corners - pixel coords [TL, TR, BR, BL]
 * @returns {[number, number]|null} uv in [0,1] or null if outside
 */
export function inverseBilinear(x, y, corners) {
  const [p0, p1, p2, p3] = corners
  // p0---p1
  // |     |
  // p3---p2

  const a = p0[0] - p1[0] + p2[0] - p3[0]
  const b = -p0[0] + p1[0]
  const c = -p0[0] + p3[0]
  const d = p0[0] - x
  const e = p0[1] - p1[1] + p2[1] - p3[1]
  const f = -p0[1] + p1[1]
  const g = -p0[1] + p3[1]
  const h = p0[1] - y

  let u
  let v
  const A = a * f - b * e

  if (Math.abs(A) < 1e-10) {
    // Affine / near-rectangle
    const denom = b * g - c * f
    if (Math.abs(denom) < 1e-10) return null
    u = (c * h - d * g) / denom
    v = (d * f - b * h) / denom
  } else {
    const B = e * d - a * h + g * b - f * c
    const C = d * g - c * h
    const disc = B * B - 4 * A * C
    if (disc < 0) return null
    const sqrtD = Math.sqrt(disc)
    const vCand = [(-B + sqrtD) / (2 * A), (-B - sqrtD) / (2 * A)]
    v = null
    for (const cand of vCand) {
      if (cand >= -0.03 && cand <= 1.03) {
        v = cand
        break
      }
    }
    if (v === null) return null
    const denom = b + a * v
    if (Math.abs(denom) > 1e-10) u = -(c * v + d) / denom
    else {
      const denom2 = f + e * v
      if (Math.abs(denom2) < 1e-10) return null
      u = -(g * v + h) / denom2
    }
  }

  if (u < -0.03 || u > 1.03 || v < -0.03 || v > 1.03) return null
  return [clamp01(u), clamp01(v)]
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

export function quadToPixels(quadNorm, width, height) {
  return quadNorm.map(([nx, ny]) => [nx * width, ny * height])
}

export function quadBBox(corners) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of corners) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return {
    x0: Math.floor(minX) - 1,
    y0: Math.floor(minY) - 1,
    x1: Math.ceil(maxX) + 1,
    y1: Math.ceil(maxY) + 1,
  }
}

/** Sample pattern atlas with wrap + bilinear filter. */
export function samplePattern(patData, patW, patH, u, v, tilesU, tilesV) {
  let pu = u * tilesU
  let pv = v * tilesV
  pu = pu - Math.floor(pu)
  pv = pv - Math.floor(pv)
  if (pu < 0) pu += 1
  if (pv < 0) pv += 1

  const x = pu * (patW - 1e-6)
  const y = pv * (patH - 1e-6)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = (x0 + 1) % patW
  const y1 = (y0 + 1) % patH
  const fx = x - x0
  const fy = y - y0
  const d = patData

  const i00 = (y0 * patW + x0) * 4
  const i10 = (y0 * patW + x1) * 4
  const i01 = (y1 * patW + x0) * 4
  const i11 = (y1 * patW + x1) * 4

  const r =
    d[i00] * (1 - fx) * (1 - fy) +
    d[i10] * fx * (1 - fy) +
    d[i01] * (1 - fx) * fy +
    d[i11] * fx * fy
  const g =
    d[i00 + 1] * (1 - fx) * (1 - fy) +
    d[i10 + 1] * fx * (1 - fy) +
    d[i01 + 1] * (1 - fx) * fy +
    d[i11 + 1] * fx * fy
  const b =
    d[i00 + 2] * (1 - fx) * (1 - fy) +
    d[i10 + 2] * fx * (1 - fy) +
    d[i01 + 2] * (1 - fx) * fy +
    d[i11 + 2] * fx * fy
  return [r, g, b]
}
