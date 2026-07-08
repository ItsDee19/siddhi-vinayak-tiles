// Model A — Small Bathroom (PRD §4.2)
// 8 ft long × 5 ft wide floor, 8 ft walls.
// Two long walls tiled in 3-2-3 horizontal bands:
//   0-3ft  lower wall
//   3-5ft  feature band
//   5-8ft  upper wall
// Optional shower fixture (grey cylinder).

import BandedWall from '../primitives/BandedWall'
import TexturedFloor from '../primitives/TexturedFloor'
import { ShowerFixture } from '../primitives/FixturePlaceholder'

const BANDS = [
  { y0: 0, y1: 3, zoneId: 'lower' },
  { y0: 3, y1: 5, zoneId: 'feature' },
  { y0: 5, y1: 8, zoneId: 'upper' },
]

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
      {/* Floor: 8 ft long × 5 ft wide. Centered on origin. */}
      <TexturedFloor
        size={[8, 5]}
        position={[0, 0, 0]}
        source={zoneTextures.floor}
        repeat={2}
        isActive={activeZone === 'floor'}
        onClick={() => onZoneClick?.('floor')}
      />

      {/* Back wall — the long 8ft wall at z = -2.5 */}
      <BandedWall
        position={[0, 0, -2.5]}
        width={8}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Side wall — left short 5ft wall at x = -4 */}
      <BandedWall
        position={[-4, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={5}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Optional shower fixture (toggle) — placed in the back-right corner */}
      {showShower && <ShowerFixture position={[1, 0, -1.2]} />}
    </group>
  )
}
