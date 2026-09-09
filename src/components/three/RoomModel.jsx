import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { loadZoneTexture, resolveZoneSource } from '../../utils/threeTextures'
import { getFinish } from '../../utils/finishMaterial'
import { deriveSurfaceMaps } from '../../utils/derivedMaps'
import { computeTileRepeat, configureTileSurface, getTileSizeMM } from '../../utils/tileMaterial'
import { roomFactories } from './rooms'
import { prepareRoom } from './rooms/prepareRoom'
import { disposeRoom } from './rooms/roomKit'
import RoomMirror from './rooms/RoomMirror'
import { applyAuthoredFixtures, AUTHORED_FIXTURES_URL } from './rooms/authoredFixtures'
import { createVanityBasin } from './rooms/vanity'

useGLTF.setDecoderPath('/draco/')

export default function RoomModel({ roomId, zones, zoneTextures, onZoneClick, basinProduct, modelExtras = {}, tier = 'full', materialKey, onMaterialStatus }) {
  const { invalidate } = useThree()
  const { scene: fixtures } = useGLTF(AUTHORED_FIXTURES_URL)
  const instance = useMemo(() => {
    const root = roomFactories[roomId](roomId === 'vanity' ? { includeBasin: false } : undefined)
    try {
      return prepareRoom(applyAuthoredFixtures(root, fixtures), zones)
    } catch (error) {
      disposeRoom(root)
      throw error
    }
  }, [roomId, zones, fixtures])
  // Basin choices own their mesh and finish. Replacing one never rebuilds the
  // tiled room or mutates the GLTF cache shared with the two bathrooms.
  const basinInstance = useMemo(() => {
    if (roomId !== 'vanity') return null
    const root = createVanityBasin(basinProduct)
    try {
      return { root: applyAuthoredFixtures(root, fixtures), active: false }
    } catch (error) {
      disposeRoom(root)
      throw error
    }
  }, [roomId, basinProduct, fixtures])
  useEffect(() => {
    if (!basinInstance) return
    basinInstance.active = true
    return () => {
      basinInstance.active = false
      queueMicrotask(() => { if (!basinInstance.active) disposeRoom(basinInstance.root) })
    }
  }, [basinInstance])
  const { root, zoneMeshes, ownedTextures } = instance
  const readyAfterFrame = useRef(null)
  const sizeMultiplier = 1
  const groutEnabled = true
  useEffect(() => {
    instance.active = true
    return () => {
      instance.active = false
      queueMicrotask(() => {
        if (instance.active) return
        ownedTextures.forEach(textures => textures.forEach(texture => texture.dispose()))
        ownedTextures.clear()
        disposeRoom(root)
      })
    }
  }, [instance, root, ownedTextures])
  useEffect(() => {
    let cancelled = false
    readyAfterFrame.current = null
    onMaterialStatus?.({ key: materialKey, phase: 'loading', error: '' })
    const applyZone = ({ zone, product, source, base }) => {
      const meshes = zoneMeshes[zone.id]
      if (!meshes) return
      const finish = getFinish(source?.finish)
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
            enabled: modelExtras.groutColor !== 'none',
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
    }
    // Resolve the complete design first. A broken upload or failed request
    // keeps the previous room intact, rather than mixing old and new tiles.
    Promise.allSettled(zones.map(async zone => {
      const product = zoneTextures[zone.id]
      const source = resolveZoneSource(product, tier)
      if (!zoneMeshes[zone.id]?.length || (product && !source?.url)) throw new Error('This surface has no available tile photo.')
      const base = source ? await loadZoneTexture(source, 1, tier === 'lite' ? 512 : 1024, 1, { rejectOnError: true }) : null
      return { zone, product, source, base }
    })).then(results => {
      const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value)
      try {
        if (cancelled) return
        if (results.some(result => result.status === 'rejected')) {
          onMaterialStatus?.({ key: materialKey, phase: 'error', error: 'A tile photo could not load. Your previous room is still shown. Select that tile again to retry, or choose another.' })
          return
        }
        loaded.forEach(applyZone)
        readyAfterFrame.current = { key: materialKey, frames: 0 }
        invalidate()
      } catch {
        if (!cancelled) onMaterialStatus?.({ key: materialKey, phase: 'error', error: 'This tile could not be applied. Choose another tile and try again.' })
      } finally {
        loaded.forEach(({ base }) => base?.dispose())
      }
    })
    return () => { cancelled = true; readyAfterFrame.current = null }
  }, [zones, zoneMeshes, zoneTextures, ownedTextures, tier, sizeMultiplier, groutEnabled, modelExtras.groutColor, materialKey, onMaterialStatus, invalidate])

  useFrame(() => {
    const pending = readyAfterFrame.current
    if (!pending) return
    // useFrame runs before rendering. The second callback proves the first
    // frame with the new textures has already reached the canvas.
    pending.frames += 1
    if (pending.frames < 2) { invalidate(); return }
    readyAfterFrame.current = null
    onMaterialStatus?.({ key: pending.key, phase: 'ready', error: '' })
  })

  const onRoomClick = event => {
      if (event.delta > 4) return
      const material = Array.isArray(event.object.material)
        ? event.object.material[event.face?.materialIndex || 0] : event.object.material
      // Clear shower glass passes a click through. Fixed floors and fixtures
      // occlude it, so a click cannot select a tiled wall hidden behind them.
      if (material?.transparent && material.opacity < 0.3) return
      event.stopPropagation()
      let target = event.object
      while (target) {
        if (target.userData.fixtureSelectionId === 'basin') { onZoneClick?.('basin'); return }
        target = target.parent
      }
      const zone = event.object?.userData?.zoneId
      if (zoneMeshes[zone]?.includes(event.object)) onZoneClick?.(zone)
  }
  return <>
    <primitive object={root} dispose={null} onClick={onRoomClick} />
    {basinInstance && <primitive object={basinInstance.root} dispose={null} onClick={onRoomClick} />}
    <RoomMirror root={root} tier={tier} />
  </>
}
