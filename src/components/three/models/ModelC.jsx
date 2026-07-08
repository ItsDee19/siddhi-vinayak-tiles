// Model C — Staircase (PRD §4.4)
// 22 steps total in 2 flights of 11 each, separated by a 4×4 landing.
// Step size: tread 1ft deep, riser ~7in (0.58ft), width 4ft.
// 3 texture zones: tread, riser, landing. Optional gold nosing edge.
// Auto-rotate-with-5s-pause is handled by ModelShell when interactiveAutoRotate=true.

import StepFlight from '../primitives/StepFlight'
import TexturedFloor from '../primitives/TexturedFloor'

const TREAD_DEPTH = 1
const RISER_HEIGHT = 0.58
const STEP_WIDTH = 4
const FLIGHT_STEPS = 11
const LANDING_SIZE = 4
const LANDING_Y = FLIGHT_STEPS * RISER_HEIGHT  // 6.38 ft

export default function ModelC({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  showNosing = true,
}) {
  return (
    <group>
      {/* Flight 1 — 11 steps ascending +X */}
      <StepFlight
        origin={[0, 0, 0]}
        count={FLIGHT_STEPS}
        treadDepth={TREAD_DEPTH}
        riserHeight={RISER_HEIGHT}
        width={STEP_WIDTH}
        direction={1}
        textures={{ tread: zoneTextures.tread, riser: zoneTextures.riser }}
        showNosing={showNosing}
        isActive={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Landing platform — 4ft × 4ft at top of flight 1 */}
      <TexturedFloor
        size={[LANDING_SIZE, LANDING_SIZE]}
        position={[FLIGHT_STEPS * TREAD_DEPTH + LANDING_SIZE / 2, LANDING_Y, 0]}
        source={zoneTextures.landing}
        repeat={2}
        isActive={activeZone === 'landing'}
        onClick={() => onZoneClick?.('landing')}
      />

      {/* Flight 2 — 11 steps ascending -X (turns back, classic U-stair) */}
      <StepFlight
        origin={[FLIGHT_STEPS * TREAD_DEPTH + LANDING_SIZE - TREAD_DEPTH, LANDING_Y, 0]}
        count={FLIGHT_STEPS}
        treadDepth={TREAD_DEPTH}
        riserHeight={RISER_HEIGHT}
        width={STEP_WIDTH}
        direction={-1}
        textures={{ tread: zoneTextures.tread, riser: zoneTextures.riser }}
        showNosing={showNosing}
        isActive={activeZone}
        onZoneClick={onZoneClick}
      />
    </group>
  )
}
