import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { loadZoneTexture, resolveZoneSource } from '../../utils/threeTextures'
import { getFinish } from '../../utils/finishMaterial'
import { deriveSurfaceMaps } from '../../utils/derivedMaps'
import { computeTileRepeat, configureTileSurface, getTileSizeMM, repairTileUVs } from '../../utils/tileMaterial'
import { applyStructuralEdits, applyMaterialEdits } from './sceneEdits'
import { applyModelDetails, disposeModelDetails } from './modelDetails'

useGLTF.setDecoderPath('/draco/')

const STANDARD_PROPS = [
  'name', 'map', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity',
  'emissiveMap', 'aoMap', 'aoMapIntensity', 'normalMap', 'normalScale', 'normalMapType',
  'roughnessMap', 'metalnessMap', 'alphaMap', 'bumpMap', 'bumpScale',
  'envMapIntensity', 'side', 'flatShading', 'transparent', 'opacity', 'alphaTest',
  'depthWrite', 'depthTest', 'vertexColors', 'toneMapped',
]

function toPhysical(source) {
  if (source.isMeshPhysicalMaterial) return source.clone()
  const out = new THREE.MeshPhysicalMaterial()
  for (const key of STANDARD_PROPS) {
    const value = source[key]
    if (value === undefined || value === null) continue
    if (value.isColor || value.isVector2) out[key].copy(value)
    else out[key] = value
  }
  return out
}

// Kept as a named export for callers; UV derivatives include all parent scale.
export function computeRepeat(mesh, product, _glbUrl, sizeMultiplier, texAspect) {
  return computeTileRepeat(mesh, product, sizeMultiplier, texAspect)
}

function prepareScene(scene, sceneEdits, glbUrl, zones) {
  const root = applyModelDetails(applyStructuralEdits(scene.clone(true), sceneEdits), glbUrl)
  const zoneMeshes = {}
  const zoneIds = new Set(zones.map((zone) => zone.id))
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const zone = obj.name.match(/__([^_]+)$/)?.[1]
    const isTile = zoneIds.has(zone)
    const prepareMaterial = (source) => {
      const material = isTile ? toPhysical(source) : obj.userData.generated ? source : source.clone()
      // Exported glass had metallicFactor=1 and alpha=1, so the shower
      // partitions rendered as opaque silver panels hiding the selected tiles.
      if (/glass.in.frame|glass.partitions/i.test(obj.name + ' ' + source.name)) {
        material.color.set('#e5eeeb')
        material.metalness = 0
        material.roughness = 0.12
        material.transparent = true
        material.opacity = 0.16
        material.depthWrite = false
        material.side = THREE.DoubleSide
      }
      if (isTile) {
        material.emissive.set('#000000')
        material.emissiveIntensity = 0
        // Single-sided room walls act as architectural cutaways at the arc ends.
        if (/wall_(lower|feature|upper)/.test(obj.name)) material.side = THREE.FrontSide
      }
      return material
    }
    obj.material = Array.isArray(obj.material) ? obj.material.map(prepareMaterial) : prepareMaterial(obj.material)
    obj.castShadow = !(Array.isArray(obj.material) ? obj.material : [obj.material]).some((material) => material.transparent)
    obj.receiveShadow = true
    if (isTile) {
      const previousGeometry = obj.geometry
      const ownedGeometry = obj.userData.ownedGeometry
      if (repairTileUVs(obj)) {
        if (ownedGeometry) previousGeometry.dispose()
        obj.userData.ownedGeometry = true
      }
      obj.userData.tileBaseline = {
        color: obj.material.color.clone(), map: obj.material.map,
        normalMap: obj.material.normalMap, roughnessMap: obj.material.roughnessMap,
        roughness: obj.material.roughness, metalness: obj.material.metalness,
        envMapIntensity: obj.material.envMapIntensity,
        normalScale: obj.material.normalScale.clone(),
        clearcoat: obj.material.clearcoat, clearcoatRoughness: obj.material.clearcoatRoughness,
      }
      obj.userData.zoneId = zone
      ;(zoneMeshes[zone] ||= []).push(obj)
    }
  })
  applyMaterialEdits(root, sceneEdits)
  return { root, zoneMeshes, ownedTextures: new Map(), active: false }
}

export default function GLBModel({
  glbUrl,
  zones = [],
  zoneTextures = {},
  onZoneClick,
  layout,
  groutEnabled = false,
  modelExtras = {},
  tier = 'full',
  sceneEdits,
}) {
  const { scene } = useGLTF(glbUrl)
  const instance = useMemo(() => prepareScene(scene, sceneEdits, glbUrl, zones), [scene, sceneEdits, glbUrl, zones])
  const { root, zoneMeshes, ownedTextures } = instance
  const sizeMultiplier = modelExtras.repeatScale ?? 1

  // All resources owned by the clone are released, never the useGLTF cache.
  // Deferring cleanup by a microtask allows React StrictMode's effect replay.
  useEffect(() => {
    instance.active = true
    return () => {
      instance.active = false
      queueMicrotask(() => {
        if (instance.active) return
        ownedTextures.forEach((textures) => textures.forEach((texture) => texture.dispose()))
        ownedTextures.clear()
        const materials = new Set()
        root.traverse((obj) => {
          if (!obj.isMesh) return
          ;(Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((mat) => materials.add(mat))
        })
        materials.forEach((mat) => mat.dispose())
        disposeModelDetails(root)
      })
    }
  }, [instance, root, ownedTextures])

  useEffect(() => {
    let cancelled = false
    const applyZone = async (zone) => {
      const meshes = zoneMeshes[zone.id]
      if (!meshes) return
      const product = zoneTextures[zone.id]
      const source = resolveZoneSource(product, tier)
      const finish = getFinish(source?.finish)
      const base = source ? await loadZoneTexture(source, 1, tier === 'lite' ? 512 : 1024) : null
      if (cancelled) { base?.dispose(); return }
      const aspect = source?.aspect || (base?.image?.width && base?.image?.height ? base.image.width / base.image.height : undefined)
      // Colour printed into polished marble is not physical relief. Only
      // textured finishes use the image-derived normal estimate.
      const derived = base && source?.url && finish.normalScale > 0.1
        ? deriveSurfaceMaps(base.image, source.url, tier === 'lite' ? 256 : 512)
        : null
      for (const mesh of meshes) {
        const material = mesh.material
        const previous = ownedTextures.get(mesh) || []
        const owned = []
        if (!product) {
          for (const [key, value] of Object.entries(mesh.userData.tileBaseline)) {
            if (value?.isColor || value?.isVector2) material[key].copy(value)
            else material[key] = value
          }
          configureTileSurface(material, { enabled: false })
          material.needsUpdate = true
          ownedTextures.delete(mesh)
          previous.forEach((texture) => texture.dispose())
          continue
        }
        if (base) {
          const repeat = computeTileRepeat(mesh, product, sizeMultiplier, aspect)
          const map = base.clone()
          map.wrapS = map.wrapT = THREE.RepeatWrapping
          map.repeat.set(repeat.x, repeat.y)
          map.needsUpdate = true
          material.map = map
          material.color.set('#ffffff')
          owned.push(map)
          if (derived) {
            const normal = derived.normalMap.clone()
            const rough = derived.roughnessMap.clone()
            for (const texture of [normal, rough]) {
              texture.repeat.copy(map.repeat)
              texture.flipY = map.flipY
              texture.needsUpdate = true
            }
            material.normalMap = normal
            material.normalScale.set(finish.normalScale, finish.normalScale)
            material.roughnessMap = rough
            owned.push(normal, rough)
          } else {
            material.normalMap = null
            material.roughnessMap = null
          }
          configureTileSurface(material, {
            tileSizeMM: getTileSizeMM(product, aspect).map((dimension) => dimension / sizeMultiplier),
            groutColor: groutEnabled ? modelExtras.groutColor || '#c9c5bd' : '#c9c5bd',
            enabled: zone.id !== 'nosing' && zone.id !== 'counterTop',
          })
        } else {
          material.map = null
          material.normalMap = null
          material.roughnessMap = null
          material.color.set('#d6d0c5')
        }
        material.roughness = derived ? Math.min(1, finish.roughness / derived.roughnessMean) : finish.roughness
        material.metalness = 0
        material.envMapIntensity = finish.envMapIntensity
        material.clearcoat = finish.clearcoat
        material.clearcoatRoughness = finish.clearcoatRoughness
        // Selection is communicated by the picker, preserving the tile colour.
        material.emissive.set('#000000')
        material.emissiveIntensity = 0
        material.needsUpdate = true
        ownedTextures.set(mesh, owned)
        previous.forEach((texture) => texture.dispose())
      }
      base?.dispose()
    }
    Promise.all(zones.map(applyZone)).catch((error) => {
      if (!cancelled) console.warn('[Visualizer] Could not apply tile material', error)
    })
    return () => { cancelled = true }
  }, [zones, zoneMeshes, zoneTextures, ownedTextures, tier, sizeMultiplier, groutEnabled, modelExtras.groutColor])

  useEffect(() => {
    const { showShower, showWC, showNosing, showFaucet, showVanityLight, basinStyle } = modelExtras
    root.traverse((obj) => {
      if (!obj.isMesh || obj.userData.replaced) return
      const name = obj.name.toLowerCase()
      const fixture = obj.userData.fixture
      if (fixture === 'shower' || name.includes('shower')) obj.visible = showShower !== false
      else if (fixture === 'wc' || name.includes('wc')) obj.visible = showWC !== false
      else if (name.includes('nosing')) obj.visible = showNosing !== false
      else if (name.includes('faucet')) obj.visible = showFaucet !== false
      else if (name.includes('vanity_light')) obj.visible = showVanityLight !== false
      if (name.startsWith('basin_')) {
        obj.visible = name.startsWith(`basin_${basinStyle || 'vessel'}`)
      }
      const isFull = name.startsWith('wall_full')
      const isBands = name.startsWith('wall_bands')
      const isGrid = name.startsWith('wall_grid')
      if (isFull || isBands || isGrid) {
        obj.visible = (layout === 'full' && isFull) || (layout === 'bands' && isBands) || (layout === 'grid' && isGrid)
      }
    })
  }, [root, layout, modelExtras])

  // A neutral shadow receiver places the room on a stable studio surface.
  const groundY = glbUrl.includes('feature-wall') ? -1.135 : -0.045
  return (
    <group onClick={(event) => {
      const zone = event.object?.userData?.zoneId
      if (zone && onZoneClick) { event.stopPropagation(); onZoneClick(zone) }
    }}>
      <primitive object={root} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#c7c0b5" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}
