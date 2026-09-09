import { DataUtils, FloatType, HalfFloatType, LinearSRGBColorSpace, NeutralToneMapping, Source, SRGBColorSpace } from 'three'

// White-balanced illumination, independent of the site's warm UI palette.
// Finish, shadow and angle still affect a tile; light sources should not add
// a yellow/blue cast or a cinematic colour grade to its catalogue photograph.
export const ROOM_LIGHT_COLORS = Object.freeze({
  source: '#ffffff', bounce: '#aaaaaa', environment: '#a2a2a2', background: '#d3d3d3',
})
export const ROOM_COLOR_PIPELINE = Object.freeze({
  toneMapping: NeutralToneMapping, outputColorSpace: SRGBColorSpace, exposure: 1,
})

/** Preserve HDR window structure and radiance while removing its colour cast.
 * A Texture.clone() shares its Source, so detach both Source and pixel storage
 * before editing. Disposing this owned texture also releases Three's cached
 * PMREM for it, without touching useEnvironment's original cached HDR.
 */
export function createNeutralEnvironmentMap(source) {
  const image = source.image
  const halfFloat = source.type === HalfFloatType
  if (!image?.data || image.data.length !== image.width * image.height * 4
    || (!halfFloat && source.type !== FloatType)) {
    throw new Error('The showroom environment must be a linear RGBA HDR texture.')
  }
  const data = image.data.slice()
  for (let i = 0; i < data.length; i += 4) {
    const r = halfFloat ? DataUtils.fromHalfFloat(data[i]) : data[i]
    const g = halfFloat ? DataUtils.fromHalfFloat(data[i + 1]) : data[i + 1]
    const b = halfFloat ? DataUtils.fromHalfFloat(data[i + 2]) : data[i + 2]
    // Rec.709 luminance in linear sRGB, not an average of gamma-encoded RGB.
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const neutral = halfFloat ? DataUtils.toHalfFloat(luminance) : luminance
    data[i] = data[i + 1] = data[i + 2] = neutral
  }
  const texture = source.clone()
  texture.source = new Source({ ...image, data })
  texture.name = 'neutral-showroom-environment'
  texture.colorSpace = LinearSRGBColorSpace
  texture.needsUpdate = true
  return texture
}

// Keep the shadow map focused on the actual room. A small bathroom should
// not spend most of its shadow resolution on empty space outside its walls.
const STANDARD = Object.freeze({
  key: [-3.5, 7, 5], target: [0, 1, 0], fill: [5, 4, 3], extent: 6,
  keyIntensity: 1.2, fillIntensity: 0.34, environmentIntensity: 0.30,
})

export function getRoomLighting(roomId) {
  if (roomId?.startsWith('bathroom')) return {
    // Both editable wall normals point into the room (+X and +Z). Light
    // from the open front-right quadrant reaches both; a negative-X key
    // lights the outside of the left wall and makes the same tile look grey.
    ...STANDARD, key: [3.2, 5, 3.5], target: [0, 0.9, -0.6], keyIntensity: 1.1,
    extent: roomId === 'bathroom-l' ? 2.8 : 2.3,
  }
  if (roomId === 'vanity') return { ...STANDARD, extent: 3.4, target: [0, 0.8, 0.3] }
  if (roomId === 'stairs') return { ...STANDARD, extent: 5, target: [0, 2, -0.2] }
  return STANDARD
}
