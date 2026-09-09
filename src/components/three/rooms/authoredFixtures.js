import * as THREE from 'three'

export const AUTHORED_FIXTURES_URL = '/models/showroom-fixtures.glb'

// Editable architecture stays native. These Blender meshes replace only the
// fixed furnishings, inside the local envelopes used by the room factories.
const REPLACEMENTS = [
  [/^ceramic_vessel_basin$/, 'basin_compact', 'basin_pop_up_waste'],
  [/^spa_basin_(-?1)$/, 'basin_spa', match => `spa_basin_waste_${match[1]}`],
  [/^vanity_vessel_basin_(left|right|center)$/, 'basin_vanity', match => `vanity_basin_waste_${match[1]}`],
  [/^spa_freestanding_soaking_tub$/, 'bath_soaking', 'spa_tub_waste'],
  [/^folded_hand_towel$/, 'towel_drape'],
  [/^vanity_folded_towel_\d+$/, 'towel_folded'],
  [/^feature_bench_linen_pad$/, 'bench_cushion'],
]

function sourceGeometry(assetScene, name) {
  const source = assetScene.getObjectByName(name)
  if (!source?.isMesh || !source.geometry?.attributes.position) {
    throw new Error(`The showroom fixture asset is missing ${name}.`)
  }
  // Source nodes have baked, identity transforms in the exported asset. Clone
  // before computing bounds or transforming: useGLTF owns the cached original.
  const geometry = source.geometry.clone()
  geometry.computeBoundingBox()
  return geometry
}

function fitGeometry(geometry, targetGeometry) {
  if (!targetGeometry.boundingBox) targetGeometry.computeBoundingBox()
  const target = targetGeometry.boundingBox
  const source = geometry.boundingBox
  const sourceSize = source.getSize(new THREE.Vector3())
  const targetSize = target.getSize(new THREE.Vector3())
  if (Math.min(sourceSize.x, sourceSize.y, sourceSize.z) <= 0) {
    geometry.dispose()
    throw new Error('An authored showroom fixture has an empty physical dimension.')
  }
  geometry.translate(-source.min.x, -source.min.y, -source.min.z)
  geometry.scale(targetSize.x / sourceSize.x, targetSize.y / sourceSize.y, targetSize.z / sourceSize.z)
  geometry.translate(target.min.x, target.min.y, target.min.z)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function materialsOf(object) {
  return Array.isArray(object.material) ? object.material : [object.material]
}

function resourcesOf(objects) {
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() }
  for (const object of objects) {
    if (!object.isMesh) continue
    resources.geometries.add(object.geometry)
    for (const material of materialsOf(object)) {
      if (!material) continue
      resources.materials.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.textures.add(value)
    }
  }
  return resources
}

function disposeUnused(root, retiredObjects, retiredGeometries) {
  const objects = []
  root.traverse(object => { if (object.isMesh) objects.push(object) })
  const live = resourcesOf(objects)
  const retired = resourcesOf(retiredObjects)
  retiredGeometries.forEach(geometry => retired.geometries.add(geometry))
  for (const kind of ['geometries', 'materials', 'textures']) {
    for (const resource of retired[kind]) if (!live[kind].has(resource)) resource.dispose()
  }
}

function placeWaste(root, shell, name) {
  const waste = root.getObjectByName(name)
  if (!waste?.isMesh) return
  const bounds = new THREE.Box3().setFromObject(shell)
  const centre = bounds.getCenter(new THREE.Vector3())
  const ray = new THREE.Raycaster(new THREE.Vector3(centre.x, bounds.max.y + 0.1, centre.z), new THREE.Vector3(0, -1, 0))
  const hit = ray.intersectObject(shell, false)[0]
  if (!hit) throw new Error(`${shell.name} has no inner bowl floor for its waste.`)
  const wasteBounds = new THREE.Box3().setFromObject(waste)
  const position = waste.getWorldPosition(new THREE.Vector3())
  // The top sits 1.5 mm above the inner ceramic, with the unchanged body
  // recessed into it. A different bowl profile must not leave a floating disc.
  position.y += hit.point.y + 0.0015 - wasteBounds.max.y
  waste.position.copy(waste.parent.worldToLocal(position))
  waste.updateMatrixWorld(true)
}

function placeTubOverflow(root) {
  const tub = root.getObjectByName('spa_freestanding_soaking_tub')
  const overflow = root.getObjectByName('spa_tub_overflow')
  if (!tub?.userData.authoredFixture || !overflow) return
  const centre = new THREE.Box3().setFromObject(tub).getCenter(new THREE.Vector3())
  const position = overflow.getWorldPosition(new THREE.Vector3())
  centre.y = position.y
  const direction = position.clone().sub(centre).setY(0).normalize()
  const hit = new THREE.Raycaster(centre, direction).intersectObject(tub, false)[0]
  if (!hit) return
  const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(tub.matrixWorld))
  overflow.position.copy(overflow.parent.worldToLocal(hit.point.clone().addScaledVector(normal, 0.001)))
  const parentRotation = overflow.parent.getWorldQuaternion(new THREE.Quaternion()).invert()
  overflow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.applyQuaternion(parentRotation))
  overflow.updateMatrixWorld(true)
}

function replaceOlive(root, assetScene, retiredObjects) {
  const existing = []
  root.traverse(object => {
    if (object.isMesh && /^(feature_olive_branch_|feature_leaf_petiole_|feature_olive_leaf_)/.test(object.name)) existing.push(object)
  })
  if (!existing.length) return
  const foliage = existing.find(object => object.name.startsWith('feature_olive_leaf_'))?.material
  const bark = existing.find(object => object.name.startsWith('feature_olive_branch_'))?.material
  if (!foliage || !bark) throw new Error('The feature-wall planter is missing its owned foliage or bark material.')
  for (const [source, name, material] of [
    ['olive_foliage', 'feature_olive_foliage', foliage],
    ['olive_branches', 'feature_olive_branches', bark],
  ]) {
    const object = new THREE.Mesh(sourceGeometry(assetScene, source), material)
    object.name = name
    object.position.set(3.95, 0, 0.48)
    object.castShadow = true
    object.receiveShadow = true
    object.userData.ownedGeometry = true
    object.userData.authoredFixture = source
    root.add(object)
  }
  existing.forEach(object => { object.removeFromParent(); retiredObjects.push(object) })
}

/** Inject owned clones of fixed Blender furnishings into a fresh native room. */
export function applyAuthoredFixtures(root, assetScene) {
  const retiredObjects = [], retiredGeometries = [], wastes = []
  try {
    root.traverse(object => {
      if (!object.isMesh || object.userData.zoneId || object.userData.authoredFixture) return
      for (const [pattern, sourceName, wasteName] of REPLACEMENTS) {
        const match = object.name.match(pattern)
        if (!match) continue
        const source = object.userData.authoredSource || sourceName
        const geometry = fitGeometry(sourceGeometry(assetScene, source), object.geometry)
        retiredGeometries.push(object.geometry)
        object.geometry = geometry
        object.userData.ownedGeometry = true
        object.userData.authoredFixture = source
        if (wasteName) wastes.push([object, typeof wasteName === 'function' ? wasteName(match) : wasteName])
        break
      }
    })
    replaceOlive(root, assetScene, retiredObjects)
    root.updateMatrixWorld(true)
    wastes.forEach(([shell, name]) => placeWaste(root, shell, name))
    placeTubOverflow(root)
  } finally {
    disposeUnused(root, retiredObjects, retiredGeometries)
  }
  return root
}
