import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { loadZoneTexture, loadRawTexture, composeGroutTexture, resolveZoneSource } from '../../utils/threeTextures'

// Set up Draco decoder path for compressed GLB files (Google CDN)
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

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

  // Clone the scene so we don't mutate the cached GLTF
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Build a map of zoneId → mesh objects for quick lookup
  const zoneMeshes = useMemo(() => {
    const map = {}
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = obj.name || ''
      const match = name.match(/__([^_]+)$/)
      if (match) {
        const zoneId = match[1]
        if (!map[zoneId]) map[zoneId] = []
        map[zoneId].push(obj)
      }
    })
    return map
  }, [cloned])

  // Clone materials on first run so we can safely modify them
  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      if (obj.material) {
        obj.material = obj.material.clone()
        obj.material.needsUpdate = true
      }
    })
  }, [cloned])

  // Apply Blender-baked ambient occlusion as aoMap (uses uv1 = TEXCOORD_1).
  // Each mesh's AO was baked into /models/ao/<modelKey>/<meshName>__ao.png.
  // Loaded in parallel (not one-at-a-time) — models with many meshes (e.g.
  // the staircase) would otherwise take one sequential round-trip per mesh,
  // which is especially costly on higher-latency mobile connections.
  useEffect(() => {
    if (!modelKey) return
    let cancelled = false
    const meshes = []
    cloned.traverse((o) => { if (o.type === 'Mesh') meshes.push(o) })

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

  // Apply textures to zone meshes whenever zoneTextures changes.
  // repeatScale (PRD §4.5) simulates tile size: higher = smaller tiles = more repeats.
  const baseRepeat = 4
  const tileRepeat = baseRepeat * (modelExtras.repeatScale ?? 1)

  useEffect(() => {
    let cancelled = false

    async function applyTextures() {
      for (const zone of zones) {
        const meshes = zoneMeshes[zone.id]
        if (!meshes) continue

        const source = zoneTextures[zone.id]
        const src = resolveZoneSource(source)

        let tex = null
        if (src) {
          // Model D grout picker: composite grout lines between the tiles
          // (our textures are seamless single tiles with no baked grout).
          if (groutEnabled && modelExtras.groutColor && modelExtras.groutColor !== 'none') {
            const base = await loadRawTexture(src)
            if (base) tex = composeGroutTexture(base, modelExtras.groutColor, tileRepeat)
          }
          if (!tex) tex = await loadZoneTexture(src, tileRepeat, 512)
        }

        if (cancelled) return

        for (const mesh of meshes) {
          const isActive = activeZone === zone.id
          if (mesh.material.map) {
            mesh.material.map.dispose()
          }
          if (tex) {
            const texClone = tex.clone()
            texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping
            texClone.needsUpdate = true
            mesh.material.map = texClone
            mesh.material.color = new THREE.Color(0xffffff)
          } else {
            mesh.material.map = null
            mesh.material.color = new THREE.Color('#5C3A22')
          }
          mesh.material.roughness = 0.6
          mesh.material.metalness = 0.05
          mesh.material.emissive = isActive ? new THREE.Color('#C49A3C') : new THREE.Color('#000000')
          mesh.material.emissiveIntensity = isActive ? 0.12 : 0
          mesh.material.needsUpdate = true
        }
      }
    }

    applyTextures()
    return () => { cancelled = true }
  }, [zones, zoneMeshes, zoneTextures, activeZone, tileRepeat, groutEnabled, modelExtras.groutColor])

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
