import { repairTileUVs } from '../../../utils/tileMaterial.js'

export function prepareRoom(root, zones) {
  const zoneMeshes = {}
  const zoneIds = new Set(zones.map(zone => zone.id))
  root.updateMatrixWorld(true)
  root.traverse(object => {
    if (!object.isMesh) return
    if (object.userData.castShadow === false) object.castShadow = false
    const zone = object.userData.zoneId || object.name.match(/__([^_]+)$/)?.[1]
    if (!zoneIds.has(zone)) {
      delete object.userData.zoneId
      return
    }
    const previous = object.geometry
    if (repairTileUVs(object)) previous.dispose()
    object.userData.zoneId = zone
    const mat = object.material
    object.userData.tileBaseline = {
      color: mat.color.clone(), map: mat.map, normalMap: mat.normalMap,
      roughnessMap: mat.roughnessMap, roughness: mat.roughness,
      metalness: mat.metalness, envMapIntensity: mat.envMapIntensity,
      normalScale: mat.normalScale.clone(), clearcoat: mat.clearcoat,
      clearcoatRoughness: mat.clearcoatRoughness,
    }
    ;(zoneMeshes[zone] ||= []).push(object)
  })
  return { root, zoneMeshes, ownedTextures: new Map(), active: false }
}
