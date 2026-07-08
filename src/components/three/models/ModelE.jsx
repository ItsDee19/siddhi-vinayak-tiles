// Model E — Vanity / Wash Basin Counter (PRD §4.6)
// Spatial:
//   Back wall    : 10ft wide × 5ft tall, behind/above the counter
//   Counter top  : 10ft wide × 2ft deep, at 2.5ft height
//   Front panel  : 10ft wide × 2.5ft tall (floor to underside of counter)
//   Side returns : 2ft wide × 5ft tall (optional, left/right returns)
//
// 4 texture zones: backWall, counterTop, frontPanel, sideReturns
// 2 undermount basins (round/rect/vessel toggle), faucets toggle,
// vanity light strip toggle. 3 camera presets.

import TexturedPlane from '../primitives/TexturedPlane'
import { Basin, Faucet } from '../primitives/FixturePlaceholder'

const COUNTER_Y = 2.5
const COUNTER_DEPTH = 2
const WALL_HEIGHT = 5
const WALL_WIDTH = 10
const BASIN_OFFSET_X = 2.5

export default function ModelE({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  basinStyle = 'rect',
  showFaucet = true,
  showVanityLight = true,
}) {
  return (
    <group>
      {/* Back wall — 10ft × 5ft, behind the counter, mounted above counter top */}
      <TexturedPlane
        size={[WALL_WIDTH, WALL_HEIGHT]}
        position={[0, COUNTER_Y + WALL_HEIGHT / 2, -COUNTER_DEPTH / 2]}
        source={zoneTextures.backWall}
        repeat={4}
        isActive={activeZone === 'backWall'}
        onClick={() => onZoneClick?.('backWall')}
      />

      {/* Counter top — 10ft × 2ft, horizontal at 2.5ft */}
      <TexturedPlane
        size={[WALL_WIDTH, COUNTER_DEPTH]}
        position={[0, COUNTER_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        source={zoneTextures.counterTop}
        repeat={3}
        isActive={activeZone === 'counterTop'}
        onClick={() => onZoneClick?.('counterTop')}
      />

      {/* Front panel / fascia — 10ft × 2.5ft, faces the viewer */}
      <TexturedPlane
        size={[WALL_WIDTH, COUNTER_Y]}
        position={[0, COUNTER_Y / 2, COUNTER_DEPTH / 2]}
        rotation={[0, Math.PI, 0]}
        source={zoneTextures.frontPanel}
        repeat={3}
        isActive={activeZone === 'frontPanel'}
        onClick={() => onZoneClick?.('frontPanel')}
      />

      {/* Side return (left) — 2ft × 5ft, 90° to back wall */}
      <TexturedPlane
        size={[COUNTER_DEPTH, WALL_HEIGHT]}
        position={[-WALL_WIDTH / 2, COUNTER_Y + WALL_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        source={zoneTextures.sideReturns}
        repeat={2}
        isActive={activeZone === 'sideReturns'}
        onClick={() => onZoneClick?.('sideReturns')}
      />

      {/* Counter thickness slab (gives the counter visual depth) */}
      <mesh position={[0, COUNTER_Y - 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_WIDTH, 0.2, COUNTER_DEPTH]} />
        <meshStandardMaterial color="#3D2512" roughness={0.8} />
      </mesh>

      {/* 2 basins — positioned on top of counter, slightly inset */}
      <Basin position={[-BASIN_OFFSET_X, COUNTER_Y, 0]} style={basinStyle} />
      <Basin position={[BASIN_OFFSET_X, COUNTER_Y, 0]} style={basinStyle} />

      {/* Faucets behind each basin */}
      {showFaucet && <Faucet position={[-BASIN_OFFSET_X, COUNTER_Y + 0.5, -0.6]} />}
      {showFaucet && <Faucet position={[BASIN_OFFSET_X, COUNTER_Y + 0.5, -0.6]} />}

      {/* Vanity light strip — emissive plane above the back wall, lights the counter */}
      {showVanityLight && (
        <mesh position={[0, COUNTER_Y + WALL_HEIGHT + 0.3, -COUNTER_DEPTH / 2 + 0.05]}>
          <planeGeometry args={[WALL_WIDTH * 0.8, 0.2]} />
          <meshStandardMaterial color="#fff5e0" emissive="#fff5e0" emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  )
}
