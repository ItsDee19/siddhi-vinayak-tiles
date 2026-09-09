import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  Color, DataTexture, DataUtils, EquirectangularReflectionMapping, FloatType,
  LinearFilter, LinearSRGBColorSpace, NeutralToneMapping, RGBAFormat, SRGBColorSpace,
} from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { ToneMappingEffect, ToneMappingMode } from 'postprocessing'
import { createNeutralEnvironmentMap, getRoomLighting, ROOM_COLOR_PIPELINE, ROOM_LIGHT_COLORS } from './roomLighting.js'

test('neutralizing an HDR owns its source and pixels while retaining radiance and texture orientation', () => {
  const pixels = new Float32Array([2, 0.5, 0.25, 1, 0.02, 0.02, 0.02, 0.7, 20, 16, 8, 1])
  const source = new DataTexture(pixels, 3, 1, RGBAFormat, FloatType)
  source.mapping = EquirectangularReflectionMapping
  source.colorSpace = LinearSRGBColorSpace
  source.minFilter = source.magFilter = LinearFilter
  source.flipY = true
  const originalSource = source.source
  const originalPixels = pixels.slice()
  const neutral = createNeutralEnvironmentMap(source)

  assert.notEqual(neutral, source)
  assert.notEqual(neutral.source, originalSource)
  assert.notEqual(neutral.image.data, pixels)
  assert.equal(source.source, originalSource)
  assert.deepEqual(pixels, originalPixels)
  assert.equal(neutral.flipY, source.flipY)
  assert.equal(neutral.mapping, source.mapping)
  assert.equal(neutral.colorSpace, LinearSRGBColorSpace)
  assert.equal(neutral.minFilter, LinearFilter)
  for (let i = 0; i < pixels.length; i += 4) {
    const expected = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
    assert.ok(Math.abs(neutral.image.data[i] - expected) < 0.000001)
    assert.equal(neutral.image.data[i], neutral.image.data[i + 1])
    assert.equal(neutral.image.data[i], neutral.image.data[i + 2])
    assert.equal(neutral.image.data[i + 3], pixels[i + 3])
  }
  assert.ok(neutral.image.data[8] > 1, 'window highlights retain HDR radiance')
  let cachedSourceDisposed = false
  source.addEventListener('dispose', () => { cachedSourceDisposed = true })
  neutral.dispose()
  assert.equal(cachedSourceDisposed, false)
  source.dispose()
})

test('the shipped half-float showroom map stays neutral without losing window contrast', () => {
  const file = readFileSync(new URL('../../../../public/hdri/showroom.hdr', import.meta.url))
  const parsed = new RGBELoader().parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength))
  const source = new DataTexture(parsed.data, parsed.width, parsed.height, RGBAFormat, parsed.type)
  source.colorSpace = LinearSRGBColorSpace
  const neutral = createNeutralEnvironmentMap(source)
  let minimum = Infinity, maximum = 0
  for (let i = 0; i < parsed.data.length; i += 4) {
    const luminance = DataUtils.fromHalfFloat(neutral.image.data[i])
    const original = [0, 1, 2].map(channel => DataUtils.fromHalfFloat(parsed.data[i + channel]))
    const expected = original[0] * 0.2126 + original[1] * 0.7152 + original[2] * 0.0722
    assert.ok(Number.isFinite(luminance) && luminance > 0)
    assert.ok(Math.abs(luminance - expected) <= expected * 0.001 + 0.000001, 'half-float rounding preserves luminance')
    assert.equal(neutral.image.data[i], neutral.image.data[i + 1])
    assert.equal(neutral.image.data[i], neutral.image.data[i + 2])
    assert.equal(neutral.image.data[i + 3], parsed.data[i + 3])
    minimum = Math.min(minimum, luminance)
    maximum = Math.max(maximum, luminance)
  }
  assert.ok(maximum > 10, 'bright window shapes survive neutralization')
  assert.ok(maximum / minimum > 50, 'reflection structure keeps its dynamic range')
  neutral.dispose()
  source.dispose()
})

test('display pipeline uses one supported Neutral operator with white-balanced room sources', () => {
  assert.equal(ROOM_COLOR_PIPELINE.toneMapping, NeutralToneMapping)
  assert.equal(ROOM_COLOR_PIPELINE.outputColorSpace, SRGBColorSpace)
  assert.equal(ROOM_COLOR_PIPELINE.exposure, 1)
  const effect = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })
  assert.equal(effect.defines.get('toneMapping(texel)'), 'NeutralToneMapping(texel)')
  assert.equal(effect.adaptiveLuminancePass.enabled, false, 'tile selection cannot trigger adaptive exposure')
  effect.dispose()
  for (const value of Object.values(ROOM_LIGHT_COLORS)) {
    const color = new Color(value)
    assert.equal(color.r, color.g)
    assert.equal(color.g, color.b)
  }
  for (const room of ['bathroom-s', 'bathroom-l', 'stairs', 'feature-wall', 'vanity']) {
    const lighting = getRoomLighting(room)
    assert.ok(lighting.extent > 0 && lighting.keyIntensity > 0)
    assert.equal(lighting.environmentIntensity, 0.3, 'all rooms use the same environment exposure')
  }
})

test('both bathroom tile-wall normals receive balanced direct illumination', () => {
  for (const room of ['bathroom-s', 'bathroom-l']) {
    const light = getRoomLighting(room)
    const keyDirection = light.key.map((value, axis) => value - light.target[axis])
    const keyLength = Math.hypot(...keyDirection)
    const leftCosine = keyDirection[0] / keyLength
    const backCosine = keyDirection[2] / keyLength
    assert.ok(leftCosine > 0.45 && backCosine > 0.45, 'key reaches the interior +X and +Z wall faces')
    assert.ok(Math.max(leftCosine, backCosine) / Math.min(leftCosine, backCosine) < 1.35)
    // The fill DirectionalLight uses Three's default target at the origin.
    const fillLength = Math.hypot(...light.fill)
    const left = light.keyIntensity * leftCosine + light.fillIntensity * light.fill[0] / fillLength
    const back = light.keyIntensity * backCosine + light.fillIntensity * light.fill[2] / fillLength
    assert.ok(Math.max(left, back) / Math.min(left, back) < 1.15,
      'combined key/fill illuminance differs by less than 15% before local shadows and reflections')
  }
})
