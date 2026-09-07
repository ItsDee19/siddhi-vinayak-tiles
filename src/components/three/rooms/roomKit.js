import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { woodMaterial } from './architecturalMaterials.js'
export { woodMaterial, fabricMaterial, stoneMaterial, plasterMaterial } from './architecturalMaterials.js'

// All dimensions are metres. The factories own their geometry and materials;
// no cached GLB or texture can be mutated by another room.
export const room = (name) => { const root = new THREE.Group(); root.name = name; return root }
export const material = (color, roughness = 0.6, metalness = 0) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness })

function mesh(root, name, geometry, position, mat) {
  const object = new THREE.Mesh(geometry, mat)
  object.name = name
  object.position.set(...position)
  object.castShadow = !mat.transparent
  object.receiveShadow = true
  object.userData.ownedGeometry = true
  root.add(object)
  return object
}

export function box(root, name, size, position, mat, radius = 0) {
  return mesh(root, name, radius > 0
    ? new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(v => v / 2)))
    : new THREE.BoxGeometry(...size), position, mat)
}
export function panel(root, name, width, height, position, rotation, mat) {
  const object = mesh(root, name, new THREE.PlaneGeometry(width, height), position, mat)
  object.rotation.set(...rotation)
  return object
}
export function cylinder(root, name, radiusTop, radiusBottom, height, position, mat, segments = 40) {
  return mesh(root, name, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), position, mat)
}
export function sphere(root, name, scale, position, mat) {
  const object = mesh(root, name, new THREE.SphereGeometry(1, 40, 24), position, mat)
  object.scale.set(...scale)
  return object
}
export function tube(root, name, points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
  return mesh(root, name, new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), radius, 12, false), [0, 0, 0], mat)
}
export function tile(root, name, zone, size, position, rotation = [0, 0, 0]) {
  const object = box(root, `${name}__${zone}`, size, position, material('#e2ddd3', 0.3))
  object.rotation.set(...rotation)
  object.userData.zoneId = zone
  // Architectural shells transmit our broad daylight sources. Fixtures and
  // reveals supply local contact shadows without closing off the light rig.
  object.castShadow = false
  object.userData.castShadow = false
  return object
}

export function disposeRoom(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set()
  root.traverse(object => {
    if (!object.isMesh) return
    if (object.isInstancedMesh) instances.add(object)
    geometries.add(object.geometry)
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(mat)
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value)
    }
  })
  // InstancedMesh owns its instanceMatrix/instanceColor GPU buffers separately
  // from the shared geometry and material used by its individual instances.
  instances.forEach(value => value.dispose())
  geometries.forEach(value => value.dispose())
  materials.forEach(value => value.dispose())
  textures.forEach(value => value.dispose())
}

// A finished entrance behind the viewer closes the far edges of wide-angle
// views and gives mirrors real architecture to reflect.
export function entryWall(root, width, height, z) {
  const opening = 0.96, doorHeight = 2.18
  const sideWidth = (width - opening) / 2
  for (const sign of [-1, 1]) tile(root, `entry_wall_${sign}`, 'wall',
    [sideWidth, height, 0.12], [sign * (opening + sideWidth) / 2, height / 2, z + 0.06])
  tile(root, 'entry_lintel', 'wall', [opening, height - doorHeight, 0.12], [0, (height + doorHeight) / 2, z + 0.06])
  const oak = woodMaterial('#957451'), trim = material('#51493e', 0.65), metal = material('#77776e', 0.25, 0.8)
  const door = box(root, 'entrance_door', [opening - 0.05, doorHeight - 0.03, 0.045], [0, doorHeight / 2, z + 0.012], oak, 0.004)
  door.castShadow = false; door.userData.castShadow = false
  for (const x of [-opening / 2, opening / 2]) box(root, `door_frame_${x}`, [0.045, doorHeight + 0.025, 0.05], [x, doorHeight / 2, z - 0.025], trim)
  box(root, 'door_frame_head', [opening + 0.045, 0.045, 0.05], [0, doorHeight, z - 0.025], trim)
  box(root, 'door_lever', [0.115, 0.016, 0.045], [0.32, 1.01, z - 0.04], metal, 0.006)
  return root
}
