// Model B — Large Bathroom (PRD §4.3)
// 10 ft × 10 ft floor, 8 ft walls.
// 2-4-2 horizontal bands:
//   0-2ft  lower band
//   2-6ft  main feature band (4ft — wide center, the dominant tile zone)
//   6-8ft  upper band
// Two adjacent walls tiled (corner view) — back + right.
// Optional shower (grey cylinder) + WC (white box) placeholders.

import BandedWall from '../primitives/BandedWall'
import TexturedFloor from '../primitives/TexturedFloor'
import { ShowerFixture, WCFixture } from '../primitives/FixturePlaceholder'

const BANDS = [
  { y0: 0, y1: 2, zoneId: 'lower' },
  { y0: 2, y1: 6, zoneId: 'feature' },
  { y0: 6, y1: 8, zoneId: 'upper' },
]

export default function ModelB({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  showShower = true,
  showWC = true,
}) {
  const wallTextures = {
    lower: zoneTextures.lower,
    feature: zoneTextures.feature,
    upper: zoneTextures.upper,
  }
  return (
    <group>
      {/* Floor: 10 ft × 10 ft. Plain white — tiles go on walls only. */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.25} metalness={0} />
      </mesh>

      {/* Back wall — 10ft at z = -5 */}
      <BandedWall
        position={[0, 0, -5]}
        width={10}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Right wall — adjacent 10ft wall at x = 5 (corner view) */}
      <BandedWall
        position={[5, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={10}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Optional fixtures (toggled via props) */}
      {showShower && <ShowerFixture position={[-3.5, 0, -3.5]} />}
      {showWC && <WCFixture position={[3.5, 0, -3.5]} />}
    </group>
  )
}
