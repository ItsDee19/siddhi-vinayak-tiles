import { Color, Float32BufferAttribute, Vector2, Vector3 } from 'three'

const MAX_TRIANGLE_SAMPLES = 2048
const DEFAULT_TILE_MM = 600

// Size follows the source image's orientation, including portrait slabs.
// Some imported catalogue dimensions have the wrong aspect, so keep their
// major length and use the shipped swatch's aspect to recover the minor one.
export function getTileSizeMM(product, texAspect) {
  const match = String(product?.size || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  const width = Number(match?.[1]) || DEFAULT_TILE_MM
  const height = Number(match?.[2]) || DEFAULT_TILE_MM
  const major = Math.max(width, height)
  const aspect = Number.isFinite(texAspect) && texAspect > 0 ? texAspect : width / height
  return aspect >= 1 ? [major, major / aspect] : [major * aspect, major]
}

/**
 * Repair the tile UV channel without modifying the cached GLTF geometry.
 * The bathroom exports have a folded UV quad: the top and bottom edges run
 * in opposite directions, shearing every swatch across the face diagonal.
 * Project each face in metres along its dominant normal. Splitting shared
 * vertices keeps wall/edge/step projections independent; all other channels
 * (especially the baked AO UVs) survive toNonIndexed(). World positions keep
 * adjoining panels aligned, including separate meshes and step risers.
 *
 * Call once after structural scene edits; dispose the new geometry on unmount.
 */
export function repairTileUVs(mesh) {
  if (!mesh.geometry?.getAttribute('position') || mesh.userData.tileUVsRepaired) return false
  mesh.updateWorldMatrix(true, false)
  const source = mesh.geometry
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const positions = geometry.getAttribute('position')
  const uvs = new Float32Array(positions.count * 2)
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const ab = new Vector3(), ac = new Vector3(), normal = new Vector3()

  for (let i = 0; i + 2 < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
    b.fromBufferAttribute(positions, i + 1).applyMatrix4(mesh.matrixWorld)
    c.fromBufferAttribute(positions, i + 2).applyMatrix4(mesh.matrixWorld)
    normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
    const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z)
    const axis = ny >= nx && ny >= nz ? 'floor' : nx >= nz ? 'side' : 'wall'
    for (const [offset, point] of [[0, a], [1, b], [2, c]]) {
      const target = (i + offset) * 2
      uvs[target] = axis === 'side' ? -point.z : point.x
      uvs[target + 1] = axis === 'floor' ? -point.z : point.y
    }
  }

  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  // Existing tangents describe the old UVs. Three can reconstruct them from
  // derivatives, while preserving the authored bevel and smooth normals.
  geometry.deleteAttribute('tangent')
  mesh.geometry = geometry
  mesh.userData.tileUVsRepaired = true
  return true
}

function weightedMedian(samples) {
  samples.sort((a, b) => a.value - b.value)
  const midpoint = samples.reduce((sum, sample) => sum + sample.weight, 0) / 2
  let weight = 0
  for (const sample of samples) {
    weight += sample.weight
    if (weight >= midpoint) return sample.value
  }
  return samples.at(-1)?.value ?? 1
}

/** Real metres covered by one UV unit, with node/parent scale included. */
export function measureUVSize(mesh) {
  const geometry = mesh.geometry
  const positions = geometry?.getAttribute('position')
  const uv = geometry?.getAttribute('uv')
  if (!positions || !uv) return null
  mesh.updateWorldMatrix(true, false)
  const index = geometry.index
  const triangles = Math.floor((index?.count ?? positions.count) / 3)
  const stride = Math.max(1, Math.ceil(triangles / MAX_TRIANGLE_SAMPLES))
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const ab = new Vector3(), ac = new Vector3(), cross = new Vector3()
  const uDirection = new Vector3(), vDirection = new Vector3()
  const uSamples = [], vSamples = []

  for (let triangle = 0; triangle < triangles; triangle += stride) {
    const start = triangle * 3
    const ia = index ? index.getX(start) : start
    const ib = index ? index.getX(start + 1) : start + 1
    const ic = index ? index.getX(start + 2) : start + 2
    a.fromBufferAttribute(positions, ia).applyMatrix4(mesh.matrixWorld)
    b.fromBufferAttribute(positions, ib).applyMatrix4(mesh.matrixWorld)
    c.fromBufferAttribute(positions, ic).applyMatrix4(mesh.matrixWorld)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const du1 = uv.getX(ib) - uv.getX(ia), dv1 = uv.getY(ib) - uv.getY(ia)
    const du2 = uv.getX(ic) - uv.getX(ia), dv2 = uv.getY(ic) - uv.getY(ia)
    const determinant = du1 * dv2 - du2 * dv1
    const area = cross.crossVectors(ab, ac).length()
    if (Math.abs(determinant) < 1e-10 || area < 1e-12) continue
    uDirection.copy(ab).multiplyScalar(dv2).addScaledVector(ac, -dv1).divideScalar(determinant)
    vDirection.copy(ac).multiplyScalar(du1).addScaledVector(ab, -du2).divideScalar(determinant)
    const uLength = uDirection.length(), vLength = vDirection.length()
    if (!(uLength > 0) || !(vLength > 0) || !Number.isFinite(uLength + vLength)) continue
    uSamples.push({ value: uLength, weight: area })
    vSamples.push({ value: vLength, weight: area })
  }
  if (!uSamples.length) return null
  return { x: weightedMedian(uSamples), y: weightedMedian(vSamples) }
}

export function computeTileRepeat(mesh, product, sizeMultiplier = 1, texAspect, mmPerUnit = 1000) {
  const multiplier = Number.isFinite(sizeMultiplier) && sizeMultiplier > 0 ? sizeMultiplier : 1
  const [tileWidth, tileHeight] = getTileSizeMM(product, texAspect)
  const metresPerUV = measureUVSize(mesh)
  if (!metresPerUV) return { x: multiplier, y: multiplier }
  // A narrow riser can legitimately show 0.1 tiles. Clamping the lower bound
  // to 0.25 used to stretch those partial tiles; UV repeats cost no geometry.
  return {
    x: metresPerUV.x * mmPerUnit / tileWidth * multiplier,
    y: metresPerUV.y * mmPerUnit / tileHeight * multiplier,
  }
}

const surfaceState = new WeakMap()

// CPU equivalent of the shader's box-filter integral, kept available for
// coverage calibration. One complete tile period always contains exactly
// groutWidthMM of grout, even when a pixel covers several tiles.
export function groutCoverage1D(positionMM, tileSizeMM, groutWidthMM, pixelFootprintMM) {
  const width = Math.min(1, Math.max(0, groutWidthMM / tileSizeMM))
  const footprint = Math.max(pixelFootprintMM / tileSizeMM, 1e-7)
  const position = positionMM / tileSizeMM
  const integral = (x) => {
    const period = Math.floor(x)
    const cell = x - period
    return period * width + Math.min(cell, width * 0.5) + Math.max(cell - (1 - width * 0.5), 0)
  }
  return Math.min(1, Math.max(0, (integral(position + footprint * 0.5) - integral(position - footprint * 0.5)) / footprint))
}

const SURFACE_PARS = `
uniform vec2 svtTileSizeMM;
uniform vec3 svtGroutColor;
uniform float svtGroutWidthMM;
uniform float svtBevelWidthMM;
uniform float svtSurfaceEnabled;
// Integral of a periodic grout strip centred on each integer UV boundary.
// Difference the integrals over the pixel footprint to conserve coverage:
// a 2mm joint inside a 40mm pixel contributes 5%, not a 50% dark grid line.
vec2 svtGroutIntegral(vec2 position, vec2 width) {
  vec2 cell = fract(position);
  return floor(position) * width + min(cell, width * 0.5) + max(cell - (1.0 - width * 0.5), 0.0);
}
// The same derivative basis used for bump mapping, expressed locally so it
// works with or without a normal/bump texture on MeshPhysicalMaterial.
vec3 svtEdgeNormal(vec3 eyePosition, vec3 surfaceNormal, float height) {
  vec3 sigmaX = dFdx(eyePosition);
  vec3 sigmaY = dFdy(eyePosition);
  vec3 r1 = cross(sigmaY, surfaceNormal);
  vec3 r2 = cross(surfaceNormal, sigmaX);
  float determinant = dot(sigmaX, r1);
  if (abs(determinant) < 1e-12) return surfaceNormal;
  vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(determinant) * surfaceNormal - gradient);
}
`

const SURFACE_MAP = `
#include <map_fragment>
float svtGroutMask = 0.0;
float svtEdgeHeight = 0.0;
#ifdef USE_MAP
  vec2 svtCell = fract(vMapUv);
  vec2 svtDistanceMM = min(svtCell, 1.0 - svtCell) * svtTileSizeMM;
  float svtEdgeMM = min(svtDistanceMM.x, svtDistanceMM.y);
  vec2 svtFootprint = max(fwidth(vMapUv), vec2(1e-7));
  vec2 svtJointFraction = clamp(vec2(svtGroutWidthMM) / svtTileSizeMM, 0.0, 1.0);
  vec2 svtCoverage = clamp((svtGroutIntegral(vMapUv + svtFootprint * 0.5, svtJointFraction)
    - svtGroutIntegral(vMapUv - svtFootprint * 0.5, svtJointFraction)) / svtFootprint, 0.0, 1.0);
  svtGroutMask = (1.0 - (1.0 - svtCoverage.x) * (1.0 - svtCoverage.y)) * svtSurfaceEnabled;
  vec2 svtFootprintMM = svtFootprint * svtTileSizeMM;
  float svtAA = max(svtFootprintMM.x, svtFootprintMM.y);
  float svtHalfJoint = svtGroutWidthMM * 0.5;
  float svtBevel = smoothstep(svtHalfJoint, svtHalfJoint + svtBevelWidthMM, svtEdgeMM);
  float svtBevelVisibility = 1.0 - smoothstep(svtBevelWidthMM, svtBevelWidthMM * 4.0, svtAA);
  svtEdgeHeight = svtBevel * 0.00035 * svtSurfaceEnabled * svtBevelVisibility;
  diffuseColor.rgb = mix(diffuseColor.rgb, svtGroutColor, svtGroutMask);
#endif
`

/**
 * Continuous 2mm joints and a 0.35mm bevel, with no wall-sized canvas or new
 * textures. The original albedo retains its full resolution and partial tiles
 * are never rounded to an integer grid. Repeated calls update uniforms only.
 */
export function configureTileSurface(material, {
  tileSizeMM = [DEFAULT_TILE_MM, DEFAULT_TILE_MM],
  groutColor = '#c9c5bd',
  groutWidthMM = 2,
  bevelWidthMM = 0.7,
  enabled = true,
} = {}) {
  let state = surfaceState.get(material)
  if (!state) {
    const uniforms = {
      svtTileSizeMM: { value: new Vector2() },
      svtGroutColor: { value: new Color() },
      svtGroutWidthMM: { value: 2 },
      svtBevelWidthMM: { value: 0.7 },
      svtSurfaceEnabled: { value: 1 },
    }
    const previousCompile = material.onBeforeCompile
    const previousCacheKey = material.customProgramCacheKey.bind(material)
    const baseCacheKey = previousCacheKey()
    material.onBeforeCompile = function (shader, renderer) {
      previousCompile.call(this, shader, renderer)
      Object.assign(shader.uniforms, uniforms)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SURFACE_PARS)
        .replace('#include <map_fragment>', SURFACE_MAP)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.92, svtGroutMask);')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = svtEdgeNormal(-vViewPosition, normal, svtEdgeHeight);')
        .replace('#include <clearcoat_normal_fragment_maps>', '#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal = svtEdgeNormal(-vViewPosition, clearcoatNormal, svtEdgeHeight);\n#endif')
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - svtGroutMask;\n#endif')
    }
    material.customProgramCacheKey = () => `${baseCacheKey}|svt-tile-surface-v2`
    material.needsUpdate = true
    state = { uniforms }
    surfaceState.set(material, state)
  }
  const { uniforms } = state
  uniforms.svtTileSizeMM.value.set(tileSizeMM[0], tileSizeMM[1])
  uniforms.svtGroutColor.value.set(groutColor === 'black' ? '#333333' : groutColor === 'none' ? '#c9c5bd' : groutColor)
  uniforms.svtGroutWidthMM.value = Math.max(0.1, groutWidthMM)
  uniforms.svtBevelWidthMM.value = Math.max(0.1, bevelWidthMM)
  uniforms.svtSurfaceEnabled.value = enabled && groutColor !== 'none' ? 1 : 0
}
