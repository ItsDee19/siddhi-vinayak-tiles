// Model A — Small Bathroom (PRD §4.2)
// 8 ft long × 5 ft wide floor, 8 ft walls.
// Two long walls tiled in 3-2-3 horizontal bands:
//   0-3ft  lower wall
//   3-5ft  feature band
//   5-8ft  upper wall
// Optional shower fixture (grey cylinder).
// Uses TiledSurface (Tier 1.3) for real per-tile grout instead of a flat plane.

import TiledSurface from '../primitives/TiledSurface'
import { ShowerFixture } from '../primitives/FixturePlaceholder'

const BANDS = [
  { y0: 0, y1: 3, zoneId: 'lower' },
  { y0: 3, y1: 5, zoneId: 'feature' },
  { y0: 5, y1: 8, zoneId: 'upper' },
]

// Render a single band as a row of tiles
function BandedTiledWall({ width, y0, y1, source, zoneId, activeZone, onZoneClick }) {
  const h = y1 - y0
  const cy = y0 + h / 2
  return (
    <mesh
      position={[0, cy, 0]}
      onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick(zoneId) } : undefined}
    >
      <TiledSurface
        size={[width, h]}
        tileSize={1.0}            // 1ft tiles — common bathroom size
        groutWidth={0.03}
        groutColor="#1A0E05"
        source={source}
        repeat={1}
        orientation="wall"
        isActive={activeZone === zoneId}
      />
    </mesh>
  )
}

export default function ModelA({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  showShower = true,
}) {
  const wallTextures = {
    lower: zoneTextures.lower,
    feature: zoneTextures.feature,
    upper: zoneTextures.upper,
  }
  return (
    <group>
      {/* Floor: 8 ft long × 5 ft wide. Centered on origin. 2ft tiles (large). */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => onZoneClick?.('floor')}
      >
        <TiledSurface
          size={[8, 5]}
          tileSize={2.0}            // 2ft floor tiles — large format
          groutWidth={0.04}
          groutColor="#1A0E05"
          source={zoneTextures.floor}
          repeat={1}
          orientation="floor"
          isActive={activeZone === 'floor'}
        />
      </mesh>

      {/* Back wall — the long 8ft wall at z = -2.5 */}
      <BandedTiledWall
        position={[0, 0, -2.5]}
        width={8}
        y0={0} y1={3}
        zoneId="lower"
        source={wallTextures.lower}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />
      <BandedTiledWall
        position={[0, 3, -2.5]}
        width={8}
        y0={0} y1={2}
        zoneId="feature"
        source={wallTextures.feature}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />
      <BandedTiledWall
        position={[0, 5, -2.5]}
        width={8}
        y0={0} y1={3}
        zoneId="upper"
        source={wallTextures.upper}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Side wall — left short 5ft wall at x = -4 */}
      <group position={[-4, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <BandedTiledWall
          position={[0, 0, 0]}
          width={5}
          y0={0} y1={3}
          zoneId="lower"
          source={wallTextures.lower}
          activeZone={activeZone}
          onZoneClick={onZoneClick}
        />
        <BandedTiledWall
          position={[0, 3, 0]}
          width={5}
          y0={0} y1={2}
          zoneId="feature"
          source={wallTextures.feature}
          activeZone={activeZone}
          onZoneClick={onZoneClick}
        />
        <BandedTiledWall
          position={[0, 5, 0]}
          width={5}
          y0={0} y1={3}
          zoneId="upper"
          source={wallTextures.upper}
          activeZone={activeZone}
          onZoneClick={onZoneClick}
        />
      </group>

      {/* Optional shower fixture (toggle) — placed in the back-right corner */}
      {showShower && <ShowerFixture position={[1, 0, -1.2]} />}
    </group>
  )
}
