import { useEffect, useState } from 'react'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'

// bands: [{ y0, y1, zoneId }]  — heights in scene units (= feet per PRD §4.1)
export default function BandedWall({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 8,           // wall length (ft)
  bands = [],
  zoneTextures = {},   // { [zoneId]: swatchObject | { url, isCustom } | null }
  onZoneClick,
  activeZone,
}) {
  const [textures, setTextures] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      bands.map(async (b) => {
        const raw = zoneTextures[b.zoneId]
        if (!raw) return [b.zoneId, null]
        const src = resolveZoneSource(raw)
        const tex = await loadZoneTexture(src, 4, 512)
        return [b.zoneId, tex]
      }),
    ).then((entries) => {
      if (!cancelled) setTextures(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [bands, zoneTextures])

  return (
    <group position={position} rotation={rotation}>
      {bands.map((b) => {
        const h = b.y1 - b.y0
        const cy = b.y0 + h / 2
        const isActive = activeZone === b.zoneId
        return (
          <mesh
            key={b.zoneId}
            position={[0, cy, 0]}
            onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick(b.zoneId) } : undefined}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[width, h]} />
            <meshStandardMaterial
              map={textures[b.zoneId] || null}
              color={textures[b.zoneId] ? '#ffffff' : '#5C3A22'}
              roughness={0.85}
              metalness={0.05}
              emissive={isActive ? '#C49A3C' : '#000000'}
              emissiveIntensity={isActive ? 0.18 : 0}
            />
          </mesh>
        )
      })}
    </group>
  )
}
