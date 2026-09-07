const radians = (degrees) => degrees * Math.PI / 180

export const VIEWING_ARC_DEGREES = 150

// The model stays fixed; customers inspect it from the open front of the room.
// These limits are shared by manual controls, presets and camera-reset motion.
export function getCameraControls({
  frontAzimuth = 0,
  minElevation = 0,
  maxElevation = 45,
  minDistance = 2.8,
  maxDistance = 7,
} = {}) {
  const halfArc = VIEWING_ARC_DEGREES / 2
  return {
    minAzimuthAngle: radians(frontAzimuth - halfArc),
    maxAzimuthAngle: radians(frontAzimuth + halfArc),
    minPolarAngle: radians(90 - maxElevation),
    maxPolarAngle: radians(90 - minElevation),
    minDistance,
    maxDistance,
  }
}

export function getCameraPreset(presets, active) {
  return presets[active] || presets.default || Object.values(presets)[0]
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function clampCameraOrbit(orbit, limits) {
  orbit.theta = clamp(orbit.theta, limits.minAzimuthAngle, limits.maxAzimuthAngle)
  orbit.phi = clamp(orbit.phi, limits.minPolarAngle, limits.maxPolarAngle)
  orbit.radius = clamp(orbit.radius, limits.minDistance, limits.maxDistance)
  return orbit
}
