import { useEffect, useMemo, useState } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'
import * as THREE from 'three'

// TiledSurface — generates a grid of small tile planes separated by thin
// gaps (the grout). Replaces flat planes (BandedWall / TexturedFloor) with
// a realistic tiled surface that catches light per-tile.
//
// Props:
//   size        [width, height] in feet (e.g. [8, 5])
//   tileSize    feet per tile (default 1.0) — 0.5 = 6", 1.0 = 12", 2.0 = 24"
//   groutWidth  in scene units (default 0.02 = ~1/4")
//   groutColor  hex
//   source      swatch / { url } / catalogue product
//   repeat      texture repeat per tile
//   orientation 'floor' (XY plane, rotated to XZ) | 'wall' (XY plane facing -Z)
//   roughness   override roughness 0..1
//   metalness   override metalness 0..1
//   onClick / isActive
export default function TiledSurface({
  size = [8, 5],
  tileSize = 1.0,
  groutWidth = 0.02,
  groutColor = '#1A0E05',
  source,
  repeat = 1,
  orientation = 'floor',
  roughness,
  metalness,
  onClick,
  isActive = false,
}) {
  const [tex, setTex] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (source) {
      const src = resolveZoneSource(source)
      loadZoneTexture(src, repeat, 1024).then((t) => { if (!cancelled) setTex(t) })
    } else {
      setTex(null)
    }
    return () => { cancelled = true }
  }, [source, repeat])

  // Build a deterministic list of tiles that fills the surface.
  // Each tile is slightly smaller than tileSize so a grout gap appears between them.
  const tiles = useMemo(() => {
    const [w, h] = size
    const cols = Math.max(1, Math.round(w / tileSize))
    const rows = Math.max(1, Math.round(h / tileSize))
    const actualW = w / cols
    const actualH = h / rows
    const tileW = Math.max(0.05, actualW - groutWidth)
    const tileH = Math.max(0.05, actualH - groutWidth)
    const list = []
    // Deterministic PRNG so re-renders don't change colors.
    let seed = 0xC0FFEE
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + actualW * (c + 0.5)
        const y = -h / 2 + actualH * (rows - 1 - r + 0.5) // top-to-bottom in display
        // Slight color/brightness variation per tile (Tier 2.1)
        const tint = 0.92 + rand() * 0.16
        list.push({ x, y, w: tileW, h: tileH, tint, key: `${r}-${c}` })
      }
    }
    return list
  }, [size, tileSize, groutWidth])

  // Per-finish defaults (Tier 2.3): Matte / Glossy / Polished look different
  // This reads the swatch's `finish` field if present.
  const finish = source?.finish
  const finishRoughness = roughness ?? (
    finish === 'Polished' ? 0.12 :
    finish === 'Glossy'   ? 0.22 :
    finish === 'Satin'    ? 0.38 :
    finish === 'Rough'    ? 0.92 :
    0.55  // default (Matte or unspecified)
  )
  const finishMetalness = metalness ?? (
    finish === 'Polished' ? 0.15 :
    finish === 'Glossy'   ? 0.10 :
    0.05
  )

  // Group transform: rotate for floor vs wall
  const groupRotation = orientation === 'floor'
    ? [-Math.PI / 2, 0, 0]         // lay flat
    : [0, 0, 0]                    // standing wall, facing -Z (textured plane)
  const groupPosition = orientation === 'floor'
    ? [0, 0, 0]                    // caller positions the group
    : [0, size[1] / 2, 0]          // wall surface at +Y

  return (
    <group
      position={orientation === 'floor' ? [0, 0, 0] : [0, 0, 0]}
      rotation={groupRotation}
      onClick={onClick}
    >
      {/* Grout / base layer — for floor, use the reflective material so the
          whole floor has a polished wet-look sheen. For walls, plain matte. */}
      <mesh position={[0, 0, -0.001]} receiveShadow>
        <planeGeometry args={[size[0] + 0.1, size[1] + 0.1]} />
        {orientation === 'floor' ? (
          <MeshReflectorMaterial
            color={groutColor}
            blur={[300, 100]}
            resolution={512}
            mixBlur={1}
            mixStrength={40}
            roughness={0.85}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            metalness={0.1}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial
            color={groutColor}
            roughness={0.95}
            metalness={0.0}
          />
        )}
      </mesh>
      {/* Individual tiles */}
      {tiles.map(({ x, y, w, h, tint, key }) => {
        const isFloor = orientation === 'floor'
        // For floor: also use reflective material on each tile so the tile
        // pattern reflects along with the grout. For wall: textured meshPhysical.
        return (
          <mesh
            key={key}
            position={[x, y, 0.001]}
            castShadow={!isFloor}
            receiveShadow
          >
            <planeGeometry args={[w, h]} />
            {isFloor ? (
              <MeshReflectorMaterial
                map={tex || null}
                color={tex ? new THREE.Color('#ffffff').multiplyScalar(tint).getStyle() : new THREE.Color('#5C3A22').multiplyScalar(tint).getStyle()}
                blur={[300, 100]}
                resolution={512}
                mixBlur={1}
                mixStrength={40}
                roughness={finishRoughness}
                depthScale={0.6}
                minDepthThreshold={0.4}
                maxDepthThreshold={1.4}
                metalness={finishMetalness}
                mirror={0}
                emissive={isActive ? '#C49A3C' : '#000000'}
                emissiveIntensity={isActive ? 0.12 : 0}
              />
            ) : (
              <meshPhysicalMaterial
                map={tex || null}
                color={tex ? new THREE.Color('#ffffff').multiplyScalar(tint).getStyle() : '#5C3A22'}
                roughness={finishRoughness}
                metalness={finishMetalness}
                clearcoat={finish === 'Polished' || finish === 'Glossy' ? 0.4 : 0}
                clearcoatRoughness={finish === 'Polished' ? 0.1 : 0.3}
                emissive={isActive ? '#C49A3C' : '#000000'}
                emissiveIntensity={isActive ? 0.12 : 0}
              />
            )}
          </mesh>
        )
      })}
    </group>
  )
}
