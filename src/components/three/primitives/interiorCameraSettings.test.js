import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INTERIOR_CAMERA_LIMITS,
  clampInteriorLook,
  directionFromInteriorLook,
  getInteriorPreset,
  getInteriorView,
  zoomInteriorFov,
} from './interiorCameraSettings.js'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`)

test('look-around stays inside a 150-degree front-facing arc, including repeated drags', () => {
  const limits = INTERIOR_CAMERA_LIMITS
  near(limits.maxYaw - limits.minYaw, 150 * Math.PI / 180)
  for (const sign of [-1, 1]) {
    let look = clampInteriorLook()
    for (let drag = 0; drag < 500; drag += 1) look = clampInteriorLook({ ...look, yaw: look.yaw + sign * 0.15 })
    near(look.yaw, sign * 75 * Math.PI / 180)
    assert.ok(directionFromInteriorLook(look)[2] < 0, 'viewer still looks toward room interior')
  }
})

test('pointer-style look and lens changes leave the authored eye position fixed', () => {
  const preset = { position: [0.1, 1.55, 1.7], target: [0, 1.1, -1.6] }
  const view = getInteriorView(preset)
  const next = { ...view, ...clampInteriorLook({ yaw: 10, pitch: -10, fov: 150 }) }
  assert.deepEqual(next.position, preset.position)
  assert.notEqual(view.position, preset.position, 'view owns its position array')
  near(next.pitch, -55 * Math.PI / 180)
  assert.equal(next.fov, 72)
})

test('target conversion reproduces an interior camera direction with no orbit or roll', () => {
  const preset = { position: [-0.2, 1.55, 1.9], target: [0, 1, -1.8] }
  const direction = directionFromInteriorLook(getInteriorView(preset))
  const delta = preset.target.map((value, index) => value - preset.position[index])
  const length = Math.hypot(...delta)
  direction.forEach((value, index) => near(value, delta[index] / length))
  near(Math.hypot(...direction), 1)
})

test('floor detail remains reachable and out-of-bounds targets stay within the same yaw limits', () => {
  const floor = getInteriorView({ position: [0, 1.55, 1.7], target: [0, 0, 0] })
  assert.ok(floor.pitch < -40 * Math.PI / 180)
  assert.ok(floor.pitch >= INTERIOR_CAMERA_LIMITS.minPitch)
  const rear = getInteriorView({ position: [0, 1.55, 1.7], target: [3, 2, 10] })
  near(rear.yaw, INTERIOR_CAMERA_LIMITS.maxYaw)
  const degenerate = getInteriorView({ position: [0, 1, 0], target: [0, 1, 0] })
  near(degenerate.yaw, 0)
  near(degenerate.pitch, 0)
})

test('pinch spread increases magnification without allowing excessive wide or close lenses', () => {
  const initial = 58
  const enlarged = zoomInteriorFov(initial, 100, 120)
  assert.ok(enlarged < initial)
  near(zoomInteriorFov(enlarged, 120, 100), initial)
  assert.equal(zoomInteriorFov(initial, 100, 10000), 42)
  assert.equal(zoomInteriorFov(initial, 100, 1), 72)
  assert.equal(zoomInteriorFov(initial, 0, 0), initial)
})

test('responsive defaults and stale preset names always resolve to an authored room view', () => {
  const room = { position: [0, 1.55, 2], target: [0, 1, -2] }
  const detail = { ...room, fov: 44 }
  assert.equal(getInteriorView(room).fov, 58)
  assert.equal(getInteriorView(room, { mobile: true }).fov, 64)
  assert.equal(getInteriorView(detail, { mobile: true }).fov, 44)
  assert.equal(getInteriorPreset({ default: room, detail }, 'unknown'), room)
  assert.equal(getInteriorPreset({ detail }, 'unknown'), detail)
  assert.equal(getInteriorPreset({}, 'unknown'), undefined)
})

test('a wide wall preserves its horizontal framing when a tablet narrows the canvas', () => {
  const preset = { position: [0, 1.55, 6.9], target: [0, 1.45, 0], fov: 48, fitAspect: 1.5 }
  const wide = getInteriorView(preset, { aspect: 1.5 })
  const narrow = getInteriorView(preset, { aspect: 1.3 })
  near(Math.tan(wide.fov * Math.PI / 360) * 1.5, Math.tan(narrow.fov * Math.PI / 360) * 1.3)
  assert.deepEqual(narrow.position, wide.position)
  assert.equal(getInteriorView(preset, { aspect: 1.8 }).fov, 48)
  assert.equal(getInteriorView(preset, { aspect: 0.3 }).fov, 72)
})
