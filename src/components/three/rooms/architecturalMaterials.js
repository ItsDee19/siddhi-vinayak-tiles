import * as THREE from 'three'

const TEXTURE_SIZE = 256
const MINERAL_TEXTURE_SIZE = 128
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value))
const smooth = value => value * value * value * (value * (value * 6 - 15) + 10)

function hash(x, y, seed) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 1442695041)
  value = Math.imul(value ^ value >>> 13, 1274126177)
  return ((value ^ value >>> 16) >>> 0) / 4294967295
}

// Each octave wraps on an integer lattice. Domain warps built from these
// octaves also wrap, so neither colour nor surface derivatives acquire seams.
function noiseGrid(width, height, seed) {
  const values = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values[y * width + x] = hash(x, y, seed)
  return (u, v) => {
    const px = u * width, py = v * height
    const ix = Math.floor(px), iy = Math.floor(py)
    const x = (ix % width + width) % width, y = (iy % height + height) % height
    const nextX = (x + 1) % width, nextY = (y + 1) % height
    const tx = smooth(px - ix), ty = smooth(py - iy)
    const a = values[y * width + x] * (1 - tx) + values[y * width + nextX] * tx
    const b = values[nextY * width + x] * (1 - tx) + values[nextY * width + nextX] * tx
    return a * (1 - ty) + b * ty
  }
}

function texture(data, size, color = false, repeat = 1) {
  const result = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  result.wrapS = result.wrapT = THREE.RepeatWrapping
  result.repeat.set(repeat, repeat)
  result.minFilter = THREE.LinearMipmapLinearFilter
  result.magFilter = THREE.LinearFilter
  result.generateMipmaps = true
  result.anisotropy = 8
  result.needsUpdate = true
  return result
}

function pixel(data, index, r, g = r, b = r) {
  data[index] = Math.round(clamp(r) * 255)
  data[index + 1] = Math.round(clamp(g) * 255)
  data[index + 2] = Math.round(clamp(b) * 255)
  data[index + 3] = 255
}

// Fixed architectural materials only. No global texture cache: each returned
// material owns its maps, while callers can reuse that material on many parts.
export function woodMaterial(color = '#a98159', { roughness = 0.48, seed = 17 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0, clearcoat: 0.10, clearcoatRoughness: 0.46 })
  const albedo = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  const rough = new Uint8Array(albedo.length), height = new Uint8Array(albedo.length)
  const warp = noiseGrid(5, 3, seed)
  const warpFine = noiseGrid(13, 5, seed + 1)
  const earlyWood = noiseGrid(17, 3, seed + 2)
  const lateWood = noiseGrid(47, 5, seed + 3)
  const fibres = noiseGrid(113, 17, seed + 4)
  const pores = noiseGrid(127, 39, seed + 5)
  const cross = noiseGrid(9, 17, seed + 6)
  const roughnessCeiling = Math.min(1, roughness + 0.13)
  mat.roughness = roughnessCeiling
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = y / TEXTURE_SIZE
    const grainU = u + (warp(u, v) - 0.5) * 0.070 + (warpFine(u, v) - 0.5) * 0.016
    const early = earlyWood(grainU, v)
    const late = Math.pow(lateWood(grainU, v), 4)
    const fibre = fibres(grainU, v)
    const pore = Math.pow(clamp((pores(grainU, v) - 0.57) / 0.43), 3)
    const value = 0.985 + (early - 0.5) * 0.045 + (fibre - 0.5) * 0.032 - late * 0.16 - pore * 0.065
    const warmth = (early - 0.5) * 0.012 + late * 0.016
    const index = (y * TEXTURE_SIZE + x) * 4
    pixel(albedo, index, value + warmth * 0.3, value, value - warmth * 0.8)
    const localRoughness = roughness + late * 0.07 + pore * 0.045 + (cross(u, v) - 0.5) * 0.025
    pixel(rough, index, localRoughness / roughnessCeiling)
    pixel(height, index, 0.65 - late * 0.40 - pore * 0.18 + (fibre - 0.5) * 0.12)
  }
  mat.map = texture(albedo, TEXTURE_SIZE, true)
  mat.roughnessMap = texture(rough, TEXTURE_SIZE)
  mat.bumpMap = texture(height, TEXTURE_SIZE)
  mat.bumpScale = 0.0002 // at most 0.2mm; sealed timber is not deeply embossed
  return mat
}

/** Fine quartz/stone minerals for fixed counters, thresholds and furniture.
 * Polished stone has colour and gloss variation, with no invented vein relief.
 */
export function stoneMaterial(color = '#e8e5dc', {
  roughness = 0.32, polished = true, scale = 1, seed = 29,
} = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0 })
  mat.clearcoat = polished ? 0.12 : 0
  mat.clearcoatRoughness = polished ? 0.28 : 0.5
  const size = MINERAL_TEXTURE_SIZE
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(albedo.length)
  const height = polished ? null : new Uint8Array(albedo.length)
  const broad = noiseGrid(7, 6, seed)
  const aggregate = noiseGrid(31, 37, seed + 1)
  const mineral = noiseGrid(41, 47, seed + 2)
  const micro = noiseGrid(61, 59, seed + 3)
  const roughnessCeiling = Math.min(1, roughness + 0.10)
  mat.roughness = roughnessCeiling
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size
    const domain = broad(u, v) - 0.5
    const grains = aggregate(u + domain * 0.04, v - domain * 0.025) - 0.5
    const crystal = mineral(u, v) - 0.5
    const fine = micro(u, v) - 0.5
    const fleck = Math.pow(Math.max(0, crystal * 2), 4)
    const value = 0.988 + domain * 0.010 + grains * 0.018 + fine * 0.017 - fleck * 0.032
    const index = (y * size + x) * 4
    pixel(albedo, index, value + grains * 0.003, value, value - grains * 0.005)
    pixel(rough, index, (roughness + crystal * 0.035 + fine * 0.020) / roughnessCeiling)
    // The honed surface uses independent fine mineral grain, never luminance
    // interpreted as a height field or a large vein projected into the normal.
    if (height) pixel(height, index, 0.5 + fine * 0.48 + crystal * 0.16)
  }
  mat.map = texture(albedo, size, true, scale)
  mat.roughnessMap = texture(rough, size, false, scale)
  if (height) {
    mat.bumpMap = texture(height, size, false, scale)
    mat.bumpScale = 0.00012
  }
  return mat
}

export function plasterMaterial(color = '#eee9df', { roughness = 0.86, scale = 2, seed = 43 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0 })
  const size = MINERAL_TEXTURE_SIZE
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(albedo.length), height = new Uint8Array(albedo.length)
  const cloud = noiseGrid(11, 13, seed)
  const grit = noiseGrid(37, 41, seed + 1)
  const micro = noiseGrid(61, 61, seed + 2)
  const roughnessCeiling = Math.min(1, roughness + 0.08)
  mat.roughness = roughnessCeiling
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size
    const grain = grit(u, v) - 0.5, fine = micro(u, v) - 0.5
    const index = (y * size + x) * 4
    pixel(albedo, index, 0.992 + (cloud(u, v) - 0.5) * 0.010 + fine * 0.012)
    pixel(rough, index, (roughness + grain * 0.04) / roughnessCeiling)
    pixel(height, index, 0.5 + grain * 0.5 + fine * 0.20)
  }
  mat.map = texture(albedo, size, true, scale)
  mat.roughnessMap = texture(rough, size, false, scale)
  mat.bumpMap = texture(height, size, false, scale)
  mat.bumpScale = 0.00015
  return mat
}

export function fabricMaterial(color = '#d1c6b6') {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, metalness: 0 })
  mat.sheen = 0.4
  mat.sheenColor.set(color)
  mat.sheenRoughness = 0.88
  const size = 128, period = 8
  const heights = new Float32Array(size * size)
  const irregularity = noiseGrid(32, 32, 53)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = 0.5 + 0.5 * Math.cos(x / period * Math.PI * 2)
    const weft = 0.5 + 0.5 * Math.cos(y / period * Math.PI * 2)
    const overUnder = 0.5 + 0.35 * Math.cos(x / period * Math.PI) * Math.cos(y / period * Math.PI)
    heights[y * size + x] = warp * overUnder + weft * (1 - overUnder) + irregularity(x / size, y / size) * 0.045
  }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Wrapped central differences produce unit-length tangent-space normals
    // and continuous derivatives at repeated swatch edges.
    const dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size]
    const dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]
    const nx = -dx * 0.55, ny = -dy * 0.55
    const length = Math.hypot(nx, ny, 1)
    pixel(data, (y * size + x) * 4, nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, 1 / length * 0.5 + 0.5)
  }
  mat.normalMap = texture(data, size, false, 12)
  mat.normalScale.set(0.20, 0.20)
  return mat
}
