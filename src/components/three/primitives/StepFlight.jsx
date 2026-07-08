import { useEffect, useState } from 'react'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'

// Generates `count` steps (tread + riser + optional gold nosing edge).
// Ascends in +X direction (or -X if `direction` = -1).
//
// PRD §4.4 — typical step size: tread 1ft deep, riser 7in (~0.58ft), width 4ft.
// 3 texture zones per step: tread (top), riser (vertical face), nosing (gold line).

export default function StepFlight({
  origin = [0, 0, 0],
  count = 11,
  treadDepth = 1,
  riserHeight = 0.58,
  width = 4,
  direction = 1,
  textures = {},            // { tread, riser }
  showNosing = true,
  isActive = null,          // 'tread' | 'riser' | null
  onZoneClick,
}) {
  const [treadTex, setTreadTex] = useState(null)
  const [riserTex, setRiserTex] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (textures.tread) {
        const src = resolveZoneSource(textures.tread)
        const t = await loadZoneTexture(src, 1, 512)
        if (!cancelled) setTreadTex(t)
      }
      if (textures.riser) {
        const src = resolveZoneSource(textures.riser)
        const t = await loadZoneTexture(src, 1, 512)
        if (!cancelled) setRiserTex(t)
      }
    }
    load()
    return () => { cancelled = true }
  }, [textures.tread, textures.riser])

  const steps = []
  for (let i = 0; i < count; i++) {
    const x = origin[0] + i * treadDepth * direction
    const y = origin[1] + (i + 1) * riserHeight
    steps.push({ i, x, y })
  }

  return (
    <group>
      {steps.map(({ i, x, y }) => (
        <group key={i} position={[x, y - riserHeight, 0]}>
          {/* Riser (vertical face) */}
          <mesh
            position={[0, riserHeight / 2, 0]}
            castShadow
            receiveShadow
            onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick('riser') } : undefined}
          >
            <planeGeometry args={[treadDepth, riserHeight]} />
            <meshStandardMaterial
              map={riserTex || null}
              color={riserTex ? '#ffffff' : '#5C3A22'}
              roughness={0.85}
              emissive={isActive === 'riser' ? '#C49A3C' : '#000000'}
              emissiveIntensity={isActive === 'riser' ? 0.18 : 0}
            />
          </mesh>
          {/* Tread (horizontal walking surface) */}
          <mesh
            position={[treadDepth * direction / 2, riserHeight, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            castShadow
            onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick('tread') } : undefined}
          >
            <planeGeometry args={[treadDepth * Math.abs(direction), width]} />
            <meshStandardMaterial
              map={treadTex || null}
              color={treadTex ? '#ffffff' : '#5C3A22'}
              roughness={0.4}
              emissive={isActive === 'tread' ? '#C49A3C' : '#000000'}
              emissiveIntensity={isActive === 'tread' ? 0.18 : 0}
            />
          </mesh>
          {/* Nosing edge (gold line) — common in Indian homes (PRD §4.4) */}
          {showNosing && (
            <mesh position={[treadDepth * direction, riserHeight, 0]}>
              <boxGeometry args={[0.05, 0.04, width]} />
              <meshStandardMaterial color="#C49A3C" metalness={0.8} roughness={0.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}
