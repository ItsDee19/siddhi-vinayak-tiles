// ---------------------------------------------------------------------------
// The maths behind the derived normal + roughness maps, with no dependency on
// three.js, the DOM or sharp.
//
// Kept separate from derivedMaps.js so the exact code that ships to the
// browser can also be run under plain Node by the verification script
// (scripts/preview_surface_maps.mjs). Checking a reimplementation would only
// prove the reimplementation works.
// ---------------------------------------------------------------------------

// Relief strength. Tuned against the real range: high enough that grout lines
// and carved relief catch a highlight, low enough that photographic grain in
// the albedo does not turn a polished face into orange peel.
export const STRENGTH = 2.4

/**
 * @param {Uint8ClampedArray|Buffer} rgba source pixels, 4 bytes per pixel
 * @param {number} W width
 * @param {number} H height
 * @returns {{normal: Uint8ClampedArray, roughness: Uint8ClampedArray, roughnessMean: number}}
 */
export function computeSurfaceMaps(rgba, W, H) {
  const normal = new Uint8ClampedArray(W * H * 4)
  const roughness = new Uint8ClampedArray(W * H * 4)

  // Luminance is the height proxy: on a tile photo, grout lines and carved
  // relief read dark, glaze and polished faces read light.
  const lumAt = (x, y) => {
    // Wrap-around sampling, so the derived maps tile as seamlessly as the
    // albedo they came from. Clamped sampling would put a visible seam at
    // every tile boundary — the exact defect the tile pipeline exists to
    // remove.
    const xi = ((x % W) + W) % W
    const yi = ((y % H) + H) % H
    const i = (yi * W + xi) * 4
    return (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255
  }

  let roughSum = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Sobel over the luminance height field.
      const tl = lumAt(x - 1, y - 1), t = lumAt(x, y - 1), tr = lumAt(x + 1, y - 1)
      const l = lumAt(x - 1, y), c = lumAt(x, y), r = lumAt(x + 1, y)
      const bl = lumAt(x - 1, y + 1), b = lumAt(x, y + 1), br = lumAt(x + 1, y + 1)

      const gx = (tr + 2 * r + br) - (tl + 2 * l + bl)
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr)

      // Tangent-space normal. X/Y are negated so a dark groove reads as
      // recessed rather than raised.
      let nx = -gx * STRENGTH
      let ny = -gy * STRENGTH
      const len = Math.hypot(nx, ny, 1) || 1
      nx /= len; ny /= len
      const nz = 1 / len

      const i = (y * W + x) * 4
      normal[i] = (nx * 0.5 + 0.5) * 255
      normal[i + 1] = (ny * 0.5 + 0.5) * 255
      normal[i + 2] = (nz * 0.5 + 0.5) * 255
      normal[i + 3] = 255

      // Roughness. Two signals, both physical rather than decorative:
      //   detail   — anywhere the surface has relief it also scatters light,
      //              so carving, stone grain and grout are rougher than a
      //              flat glazed face
      //   darkness — grout is matte cement and reads dark; a polished face
      //              reads light. A weak term, since dark polished granite
      //              exists, hence the small weight next to detail.
      const detail = Math.min(1, Math.hypot(gx, gy) * 2.2)
      const value = Math.min(1, 0.60 + 0.30 * detail + 0.20 * (1 - c))
      roughSum += value

      const v = value * 255
      roughness[i] = v
      roughness[i + 1] = v
      roughness[i + 2] = v
      roughness[i + 3] = 255
    }
  }

  return { normal, roughness, roughnessMean: roughSum / (W * H) }
}
