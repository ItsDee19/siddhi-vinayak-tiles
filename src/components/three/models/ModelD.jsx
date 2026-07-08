// Model D — Large Feature Wall (PRD §4.5)
// 30 ft wide × 10 ft tall wall, thin depth (0.5ft).
// Three layout modes (toggle in UI):
//   - 'full'    : one tile across the whole wall
//   - 'bands'   : lower band (0-4ft) + upper band (4-10ft)
//   - 'grid'    : 3×2 grid of rectangular panels
// Tile repeat scale slider (simulates different tile sizes).
// Grout color picker (when no texture is applied, the base color is the grout).

import { useEffect, useState } from 'react'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'

const PANEL_COLS = 3
const PANEL_ROWS = 2
const WALL_W = 30
const WALL_H = 10

function GroutedPanel({
  width, height, source, repeat, groutColor, position, rotation, onClick, isActive,
}) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) {
      const src = resolveZoneSource(source)
      loadZoneTexture(src, repeat, 512).then((t) => { if (!cancelled) setTex(t) })
    } else { setTex(null) }
    return () => { cancelled = true }
  }, [source, repeat])

  return (
    <mesh position={position} rotation={rotation} onClick={onClick} receiveShadow castShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : groutColor}
        roughness={0.85}
        metalness={0.05}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.18 : 0}
      />
    </mesh>
  )
}

export default function ModelD({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  layout = 'full',          // 'full' | 'bands' | 'grid'
  repeatScale = 1,          // 0.5x – 2x  (slider)
  groutColor = '#cfc6b4',
}) {
  // Map repeatScale (0.5..2) → texture.repeat value (1..16)
  // The PRD slider simulates different tile sizes: 300mm vs 600mm vs 1200mm.
  const repeat = 1 + (repeatScale - 0.5) * 10  // 0.5→1, 1→6, 2→16

  if (layout === 'bands') {
    return (
      <group>
        <GroutedPanel
          width={WALL_W} height={4}
          source={zoneTextures.lowerBand || zoneTextures.full}
          repeat={repeat}
          groutColor={groutColor}
          position={[0, 2, 0]}
          rotation={[0, 0, 0]}
          onClick={() => onZoneClick?.('lowerBand')}
          isActive={activeZone === 'lowerBand'}
        />
        <GroutedPanel
          width={WALL_W} height={6}
          source={zoneTextures.upperBand || zoneTextures.full}
          repeat={repeat}
          groutColor={groutColor}
          position={[0, 7, 0]}
          rotation={[0, 0, 0]}
          onClick={() => onZoneClick?.('upperBand')}
          isActive={activeZone === 'upperBand'}
        />
      </group>
    )
  }

  if (layout === 'grid') {
    const cellW = WALL_W / PANEL_COLS
    const cellH = WALL_H / PANEL_ROWS
    return (
      <group>
        {Array.from({ length: PANEL_ROWS }).map((_, r) =>
          Array.from({ length: PANEL_COLS }).map((_, c) => {
            const x = c * cellW - WALL_W / 2 + cellW / 2
            const y = r * cellH + cellH / 2
            return (
              <GroutedPanel
                key={`p-${r}-${c}`}
                width={cellW - 0.2}
                height={cellH - 0.2}
                source={zoneTextures.full}
                repeat={repeat / 2}
                groutColor={groutColor}
                position={[x, y, 0]}
                rotation={[0, 0, 0]}
                onClick={() => onZoneClick?.('full')}
                isActive={activeZone === 'full'}
              />
            )
          }),
        )}
      </group>
    )
  }

  // 'full' — one big textured wall
  return (
    <GroutedPanel
      width={WALL_W} height={WALL_H}
      source={zoneTextures.full}
      repeat={repeat}
      groutColor={groutColor}
      position={[0, WALL_H / 2, 0]}
      rotation={[0, 0, 0]}
      onClick={() => onZoneClick?.('full')}
      isActive={activeZone === 'full'}
    />
  )
}
