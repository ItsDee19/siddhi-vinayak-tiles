import test from 'node:test'
import assert from 'node:assert/strict'
import { clampCameraOrbit, getCameraControls, getCameraPreset } from './cameraSettings.js'

// The legacy display-model helper is retained for older embeds. New room
// cameras have separate fixed-eye tests in interiorCameraSettings.test.js.
test('legacy display-model orbit keeps a 150-degree front arc', () => {
  const limits = getCameraControls()
  assert.ok(Math.abs(limits.maxAzimuthAngle - limits.minAzimuthAngle - 150 * Math.PI / 180) < 1e-9)
  const left = clampCameraOrbit({ theta: -Math.PI, phi: Math.PI, radius: 0.01 }, limits)
  assert.equal(left.theta, limits.minAzimuthAngle)
  assert.equal(left.phi, limits.maxPolarAngle)
  assert.equal(left.radius, limits.minDistance)
  const right = clampCameraOrbit({ theta: Math.PI, phi: 0, radius: 200 }, limits)
  assert.equal(right.theta, limits.maxAzimuthAngle)
  assert.equal(right.phi, limits.minPolarAngle)
  assert.equal(right.radius, limits.maxDistance)
})
test('legacy missing presets resolve safely', () => {
  const defaultPreset = { position: [0, 2, 4], target: [0, 1, 0] }
  assert.equal(getCameraPreset({ default: defaultPreset }, 'missing'), defaultPreset)
  assert.equal(getCameraPreset({}, 'missing'), undefined)
})
