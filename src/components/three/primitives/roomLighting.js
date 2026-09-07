// Keep the shadow map focused on the actual room. A small bathroom should
// not spend most of its shadow resolution on empty space outside its walls.
const STANDARD = Object.freeze({
  key: [-3.5, 7, 5], target: [0, 1, 0], extent: 6,
  keyIntensity: 1.2, fillIntensity: 0.34, environmentIntensity: 0.30,
})

export function getRoomLighting(roomId) {
  if (roomId?.startsWith('bathroom')) return {
    ...STANDARD, key: [-3.2, 5, 3.5], target: [0, 0.9, -0.6],
    extent: roomId === 'bathroom-l' ? 2.8 : 2.3,
  }
  if (roomId === 'vanity') return { ...STANDARD, extent: 3.4, target: [0, 0.8, 0.3] }
  if (roomId === 'stairs') return { ...STANDARD, extent: 5, target: [0, 2, -0.2] }
  return STANDARD
}
