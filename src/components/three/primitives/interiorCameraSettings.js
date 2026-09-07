export const INTERIOR_CAMERA_LIMITS = Object.freeze({
  minYaw: -75 * Math.PI / 180,
  maxYaw: 75 * Math.PI / 180,
  minPitch: -55 * Math.PI / 180,
  maxPitch: 25 * Math.PI / 180,
  minFov: 42,
  maxFov: 72,
})

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback

// Looking changes a direction and the lens only. The eye position is never
// derived from an orbit radius, so dragging cannot take a viewer out of a room.
export function clampInteriorLook({ yaw = 0, pitch = 0, fov = 58 } = {}) {
  const limits = INTERIOR_CAMERA_LIMITS
  return {
    yaw: clamp(finiteOr(yaw, 0), limits.minYaw, limits.maxYaw),
    pitch: clamp(finiteOr(pitch, 0), limits.minPitch, limits.maxPitch),
    fov: clamp(finiteOr(fov, 58), limits.minFov, limits.maxFov),
  }
}

export function directionFromInteriorLook({ yaw = 0, pitch = 0 } = {}) {
  const horizontal = Math.cos(pitch)
  return [Math.sin(yaw) * horizontal, Math.sin(pitch), -Math.cos(yaw) * horizontal]
}

export function getInteriorView(preset, { mobile = false, aspect } = {}) {
  const position = [...(preset?.position || [0, 1.55, 1.7])]
  const target = preset?.target || [position[0], position[1], position[2] - 1]
  const [dx, dy, dz] = target.map((value, index) => value - position[index])
  const horizontal = Math.hypot(dx, dz)
  const hasDirection = horizontal > 1e-8 || Math.abs(dy) > 1e-8
  const baseFov = preset?.fov ?? (mobile ? 64 : 58)
  // A wide wall must still fit when a tablet makes the canvas narrower.
  // Widen the lens to preserve its horizontal framing without moving the eye.
  const fov = aspect > 0 && aspect < preset?.fitAspect
    ? 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * preset.fitAspect / aspect) * 180 / Math.PI
    : baseFov
  return {
    position,
    ...clampInteriorLook({
      yaw: horizontal > 1e-8 ? Math.atan2(dx, -dz) : 0,
      pitch: hasDirection ? Math.atan2(dy, horizontal) : 0,
      fov,
    }),
  }
}

export function getInteriorPreset(presets = {}, name) {
  return presets[name] || presets.default || Object.values(presets)[0]
}

// Screen magnification is proportional to cot(FOV / 2). Matching this ratio
// makes spreading two fingers magnify the room without moving the eye.
export function zoomInteriorFov(fov, previousDistance, distance) {
  if (!(previousDistance > 0) || !(distance > 0)) return clampInteriorLook({ fov }).fov
  const next = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * previousDistance / distance) * 180 / Math.PI
  return clampInteriorLook({ fov: next }).fov
}
