import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { loadZoneTexture, loadRawTexture, composeGroutTexture, resolveZoneSource } from '../../utils/threeTextures'
import { getFinish } from '../../utils/finishMaterial'
import { applyStructuralEdits, applyMaterialEdits } from './sceneEdits'

// Set up Draco decoder path — self-hosted so mobile browsers (iOS Safari with
// content blockers, etc.) can always load the WASM decoder without relying on
// gstatic.com CDN which can be blocked or stall on cellular networks.
useGLTF.setDecoderPath('/draco/')

// =========================================================================
// GLBModel — loads a Blender-exported GLB file and dynamically swaps
// textures on zone meshes. Mesh names follow the convention:
//   "meshName__zoneId"
// e.g. "back_wall_lower__lower" → zone "lower"
//
// The component traverses the GLB scene, finds meshes by zone suffix,
// clones their materials (so the cached GLTF isn't mutated), and applies
// the appropriate texture from the zoneTextures state.
//
// Non-zone meshes (fixtures, nosing, etc.) are left with their original
// Blender materials.
// =========================================================================

// Every GLB is authored in metres, so one scene unit is 1000mm. Used to
// convert scene units to millimetres for real-world tiling.
//
// This previously returned 304.8 (feet) for everything except the staircase,
// on the assumption that models A/B/D/E were authored in feet. Measuring the
// exports against objects of known real size shows otherwise — read as metres
// the bath is 737x492x1193mm, the toilet 251x189x362mm, the basin 412x176mm
// and the bathroom floor 2500x2000mm, all correct; read as feet they come out
// at 225mm, 76mm, 126mm and 762mm, which is doll's-house scale.
//
// The 3.28x error made every tile render far too large: a 600x1200mm tile on
// a 2.5-unit wall computed to 762/1200 = 0.63 repeats, i.e. less than a single
// tile spanning the whole wall, which is why walls showed smeared diagonal
// bands instead of tiles. At 1000 the same wall correctly takes ~2.1 tiles
// across.
const MM_PER_SCENE_UNIT = 1000

function mmPerSceneUnit() {
  return MM_PER_SCENE_UNIT
}

// Parse a catalogue size string like "600×1200mm" or "600x1200mm" into
// [wMM, hMM]. Returns null if unparseable.
function parseSizeMM(sizeStr) {
  if (!sizeStr) return null
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2])]
}

// Compute a mesh's real-world width/height in millimetres from its local
// (untransformed) geometry bounding box — the two largest axis extents are
// treated as width/height, the smallest as thickness. Local space is used
// because it is unaffected by the parent group's world rotation, so it
// stays consistent whichever way a wall panel is rotated into the scene.
function meshWorldSizeMM(mesh, mmPerUnit) {
  if (!mesh.geometry) return null
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox
  if (!box) return null
  const size = new THREE.Vector3()
  box.getSize(size)
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a)
  const [d0, d1] = dims
  if (!(d0 > 0) || !(d1 > 0)) return null
  return [d0 * mmPerUnit, d1 * mmPerUnit]
}

// Compute anisotropic repeat.x/y for a mesh from the product's real tile
// size against the mesh's real-world dimensions, replacing the old isotropic
// `repeat.set(r, r)` (which visibly stretched sources up to ~3.9:1 aspect).
// `sizeMultiplier` is the existing "Tile size" slider (repeatScale) applied
// as a scale on top of the physically-correct baseline, so the control still
// does something meaningful instead of using its own disconnected formula.
//
// Two things decide how the tile lands, and they come from different places:
//
//   SHAPE comes from the texture's own aspect (`resolved.aspect`, recorded by
//   the tile pipeline). It cannot come from the declared `size`, because a
//   large part of the catalogue's declared sizes are simply wrong — every
//   76x300mm 3x12 elevation tile is labelled "300x600mm", for instance. Using
//   the declared aspect there squashed a 3.95:1 tile into a 2:1 slot.
//
//   SCALE comes from the declared size's larger dimension, which is reliable
//   enough (600 / 400 / 300 mm) and is what sets how many tiles span a wall.
//
// Combining them — major length from the catalogue, minor length derived from
// the texture's true aspect — gives a tile that is both the right size and
// never stretched.
export function computeRepeat(mesh, product, glbUrl, sizeMultiplier, texAspect) {
  const tileMM = parseSizeMM(product?.size)
  const meshMM = meshWorldSizeMM(mesh, mmPerSceneUnit(glbUrl))
  if (!tileMM || !meshMM) return { x: sizeMultiplier, y: sizeMultiplier }
  const [meshW, meshH] = meshMM

  const tileMajor = Math.max(tileMM[0], tileMM[1])
  const declaredAspect = tileMajor / Math.min(tileMM[0], tileMM[1])
  // texAspect is width/height of the shipped texture; fold it to >= 1 to get
  // the tile's long:short ratio, independent of which way it was photographed.
  const trueAspect = texAspect
    ? (texAspect >= 1 ? texAspect : 1 / texAspect)
    : declaredAspect
  const tileMinor = tileMajor / trueAspect

  // The tile's long axis follows the surface's long axis, so tiles run along
  // a wall rather than against it.
  const [meshMajor, meshMinor] = meshW >= meshH ? [meshW, meshH] : [meshH, meshW]
  const repeatMajor = (meshMajor / tileMajor) * sizeMultiplier
  const repeatMinor = (meshMinor / tileMinor) * sizeMultiplier
  const clamp = (v) => Math.min(64, Math.max(0.25, v))
  // Re-project back onto x/y in the mesh's own orientation.
  return meshW >= meshH
    ? { x: clamp(repeatMajor), y: clamp(repeatMinor) }
    : { x: clamp(repeatMinor), y: clamp(repeatMajor) }
}

export default function GLBModel({
  glbUrl,
  zones = [],
  zoneTextures = {},
  activeZone,
  onZoneClick,
  layout,        // 'full' | 'bands' | 'grid' — Model D only
  groutEnabled = false, // Model D only: apply grout compositing (PRD §4.5)
  modelExtras = {}, // fixture toggles + controls (PRD §4): showShower, showWC,
                    // showNosing, showFaucet, showVanityLight, repeatScale, etc.
  tier = 'full', // 'full' | 'lite' — selects desktop/mobile derived tile variant
  sceneEdits,    // optional per-model scene differentiation — see sceneEdits.js
}) {
  const groupRef = useRef(null)
  const { scene } = useGLTF(glbUrl)

  // Derive the per-model key (e.g. "a-bathroom") from the glb url so we can
  // resolve the Blender-baked ambient-occlusion textures in /models/ao/<key>/.
  const modelKey = useMemo(() => {
    const m = (glbUrl || '').match(/model-([^/?#]+)\.glb/)
    return m ? m[1] : ''
  }, [glbUrl])
  const aoLoader = useMemo(() => new THREE.TextureLoader(), [])

  // Clone the scene so we don't mutate the cached GLTF. Structural scene edits
  // are applied here rather than in an effect because reparenting is not
  // idempotent and StrictMode double-invokes effects in development.
  const cloned = useMemo(
    () => applyStructuralEdits(scene.clone(true), sceneEdits),
    [scene, sceneEdits],
  )

  // Tracks the texture THIS component created and assigned per mesh, so we
  // only ever dispose textures we own — never the master cached in
  // useGLTF's scene or threeTextures' urlCache. Disposing the shared master
  // on the first texture-apply pass was a real bug: remounting the same GLB
  // (switching model tabs and back) would find it already dead on the GPU.
  const ownedTextures = useRef(new WeakMap())

  // Build a map of zoneId → mesh objects for quick lookup
  const zoneMeshes = useMemo(() => {
    const map = {}
    const isBathroom = /bathroom/i.test(glbUrl)
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = obj.name || ''
      const match = name.match(/__([^_]+)$/)
      if (match) {
        const zoneId = match[1]
        // Bathroom floor meshes: force white, non-interactive
        if (isBathroom && zoneId === 'floor') {
          obj.material = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.25, metalness: 0,
          })
          obj.receiveShadow = true
          return // don't add to zone map — not tileable
        }
        if (!map[zoneId]) map[zoneId] = []
        map[zoneId].push(obj)
      }
    })
    return map
  }, [cloned, glbUrl])

  // Clone materials once on mount and set shadow flags. Previously this ran
  // on every texture-apply pass (a second, redundant clone on top of the
  // per-mesh clone below), leaking a Material each time and forcing a
  // shader-program recompile for no reason.
  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      if (obj.material) {
        obj.material = obj.material.clone()
        obj.material.needsUpdate = true
      }
      // Walls/fixtures cast; everything receives. Non-zone backdrop planes
      // (e.g. Model D's bare "Plane") still benefit from receiving shadows.
      obj.castShadow = true
      obj.receiveShadow = true
    })
  }, [cloned])

  // Per-model material overrides. Must run after the clone pass above, which
  // would otherwise replace the materials these edits were written onto.
  // Idempotent, so re-running on a prop change is safe.
  useEffect(() => {
    applyMaterialEdits(cloned, sceneEdits)
  }, [cloned, sceneEdits])

  // Apply Blender-baked ambient occlusion as aoMap (uses uv1 = TEXCOORD_1).
  // Each mesh's AO was baked into /models/ao/<modelKey>/<meshName>__ao.png.
  // Loaded in parallel (not one-at-a-time) — models with many meshes (e.g.
  // the staircase) would otherwise take one sequential round-trip per mesh,
  // which is especially costly on higher-latency mobile connections.
  // Meshes with no matching bake (or GLBs with no TEXCOORD_1 at all) simply
  // fail the load and are left without an aoMap — handled gracefully below.
  useEffect(() => {
    if (!modelKey) return
    let cancelled = false
    const meshes = []
    cloned.traverse((o) => {
      // Skip meshes generated by sceneEdits — nothing in the bake matches them.
      if (o.type === 'Mesh' && !o.userData.generated) meshes.push(o)
    })

    const loadOne = (o) =>
      new Promise((resolve) => {
        const base = glbUrl.replace(/model-[^/?#]+\.glb.*$/, 'ao/' + modelKey)
        const url = `${base}/${o.name}__ao.png`
        aoLoader.load(
          url,
          (tex) => {
            if (cancelled) { resolve(); return }
            tex.colorSpace = THREE.NoColorSpace
            tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
            tex.channel = 1
            o.material.aoMap = tex
            o.material.aoMapIntensity = 0.9
            o.material.needsUpdate = true
            resolve()
          },
          undefined,
          () => resolve(), // no AO texture for this mesh — leave as-is
        )
      })

    Promise.all(meshes.map(loadOne))
    return () => { cancelled = true }
  }, [cloned, modelKey, aoLoader, glbUrl])

  // Apply textures + finish-driven material response to zone meshes whenever
  // zoneTextures changes. repeatScale (PRD §4.5) now scales the physically
  // computed repeat (see computeRepeat) rather than driving an independent,
  // disconnected formula.
  const sizeMultiplier = modelExtras.repeatScale ?? 1

  useEffect(() => {
    let cancelled = false

    async function applyTextures() {
      for (const zone of zones) {
        const meshes = zoneMeshes[zone.id]
        if (!meshes) continue

        const rawSource = zoneTextures[zone.id]
        const src = resolveZoneSource(rawSource, tier)
        const finish = getFinish(src?.finish)

        // Load once per zone (not per mesh) — individual meshes still get
        // their own repeat-configured clone below since two walls sharing
        // a zone can have different real widths.
        let baseTex = null
        let isGroutComposited = false
        if (src) {
          if (groutEnabled && modelExtras.groutColor && modelExtras.groutColor !== 'none') {
            const base = await loadRawTexture(src)
            if (base) {
              // Derive the grout cell counts from the same real-world repeat
              // math as the non-composited path (using the zone's first
              // mesh as the representative size) instead of an unrelated
              // constant, so the grout grid matches the physical tile size.
              // Passed as separate x/y counts: averaging them into one square
              // grid distorted every non-square tile.
              const { x: gx, y: gy } = computeRepeat(meshes[0], rawSource, glbUrl, sizeMultiplier, src.aspect)
              baseTex = composeGroutTexture(base, modelExtras.groutColor, gx, gy, 1024)
              isGroutComposited = true
            }
          }
          if (!baseTex) baseTex = await loadZoneTexture(src, 1, 512)
        }

        if (cancelled) return

        for (const mesh of meshes) {
          const isActive = activeZone === zone.id
          // Microscopic 0.1% geometry overlap to eliminate sub-pixel gaps
          // between adjacent mesh bands. `.set()` is absolute, so re-running
          // this every pass does not compound.
          mesh.scale.set(1.001, 1.001, 1.001)

          const previousOwned = ownedTextures.current.get(mesh)
          if (previousOwned) {
            previousOwned.dispose()
            ownedTextures.current.delete(mesh)
          }

          if (baseTex) {
            const texClone = baseTex.clone()
            if (isGroutComposited) {
              texClone.wrapS = texClone.wrapT = THREE.ClampToEdgeWrapping
              texClone.repeat.set(1, 1)
            } else {
              const { x: repeatX, y: repeatY } = computeRepeat(mesh, rawSource, glbUrl, sizeMultiplier, src.aspect)
              texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping
              texClone.repeat.set(repeatX, repeatY)
            }
            texClone.needsUpdate = true
            mesh.material.map = texClone
            mesh.material.color = new THREE.Color(0xffffff)
            ownedTextures.current.set(mesh, texClone)
          } else {
            mesh.material.map = null
            mesh.material.color = new THREE.Color('#5C3A22')
          }

          mesh.material.roughness = finish.roughness
          mesh.material.metalness = finish.metalness
          mesh.material.envMapIntensity = finish.envMapIntensity
          mesh.material.emissive = isActive ? new THREE.Color('#C49A3C') : new THREE.Color('#000000')
          mesh.material.emissiveIntensity = isActive ? 0.12 : 0
          mesh.material.needsUpdate = true
        }
      }
    }

    applyTextures()
    return () => { cancelled = true }
    // Deliberately excludes `activeZone` — the emissive highlight is applied
    // by the lightweight effect below instead of re-running the whole async
    // texture load + grout composite just to change which zone is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, zoneMeshes, zoneTextures, tier, sizeMultiplier, groutEnabled, modelExtras.groutColor, glbUrl])

  // Zone-selection highlight only — synchronous, no texture work.
  useEffect(() => {
    for (const zone of zones) {
      const meshes = zoneMeshes[zone.id]
      if (!meshes) continue
      const isActive = activeZone === zone.id
      for (const mesh of meshes) {
        if (!mesh.material) continue
        mesh.material.emissive.set(isActive ? '#C49A3C' : '#000000')
        mesh.material.emissiveIntensity = isActive ? 0.12 : 0
        mesh.material.needsUpdate = true
      }
    }
  }, [zones, zoneMeshes, activeZone])

  // Fixture visibility toggles (PRD §4.2–§4.6). The GLB ships fixture meshes
  // (shower_fixture, wc_fixture, *_nosing, faucet_*, vanity_light) that the
  // UI toggles via modelExtras. Hide/show them by name pattern.
  useEffect(() => {
    const { showShower, showWC, showNosing, showFaucet, showVanityLight } = modelExtras
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = (obj.name || '').toLowerCase()
      if (name.includes('shower')) obj.visible = showShower !== false
      else if (name.includes('wc')) obj.visible = showWC !== false
      else if (name.includes('nosing')) obj.visible = showNosing !== false
      else if (name.includes('faucet')) obj.visible = showFaucet !== false
      else if (name.includes('vanity_light')) obj.visible = showVanityLight !== false
    })
  }, [cloned, modelExtras, modelExtras.showShower, modelExtras.showWC, modelExtras.showNosing, modelExtras.showFaucet, modelExtras.showVanityLight])

  // Basin style (PRD §4.6): the vanity GLB ships three basin variants per
  // position — basin_round_*, basin_rect_*, basin_vessel_*. Show only the
  // set matching the selected style.
  useEffect(() => {
    const style = modelExtras.basinStyle
    if (!style) return
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = (obj.name || '').toLowerCase()
      if (!name.startsWith('basin_')) return
      let show = false
      if (name.startsWith('basin_round')) show = style === 'round'
      else if (name.startsWith('basin_rect')) show = style === 'rect'
      else if (name.startsWith('basin_vessel')) show = style === 'vessel'
      obj.visible = show
    })
  }, [cloned, modelExtras, modelExtras.basinStyle])

  // Wire up click handlers for zone selection
  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = obj.name || ''
      const match = name.match(/__([^_]+)$/)
      if (match && onZoneClick) {
        const zoneId = match[1]
        obj.userData.zoneId = zoneId
      }
    })
  }, [cloned, onZoneClick])

  // Model D layout switching — toggle visibility of mesh groups
  useEffect(() => {
    if (!layout) return
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = obj.name || ''
      // Meshes prefixed with "wall_full_" = full layout
      // "wall_bands_" = bands layout
      // "wall_grid_" = grid layout
      const isFull = name.startsWith('wall_full')
      const isBands = name.startsWith('wall_bands')
      const isGrid = name.startsWith('wall_grid')

      if (isFull || isBands || isGrid) {
        obj.visible = (layout === 'full' && isFull) ||
                      (layout === 'bands' && isBands) ||
                      (layout === 'grid' && isGrid)
      }
    })
  }, [cloned, layout])

  const handleClick = (e) => {
    if (!onZoneClick) return
    e.stopPropagation()
    const zoneId = e.object?.userData?.zoneId
    if (zoneId) onZoneClick(zoneId)
  }

  return (
    <group ref={groupRef} onClick={handleClick}>
      <primitive object={cloned} />
    </group>
  )
}
