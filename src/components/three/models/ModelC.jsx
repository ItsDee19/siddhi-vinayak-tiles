// Model C — Staircase (PRD §4.4)
// L-shaped staircase: 10 steps in Flight 1 (+X), landing, 10 steps in Flight 2 (-Z).
// Real-world meter scale: 28cm treads, 18cm risers, 1.2m wide steps.
// 3 texture zones: tread, riser, landing. Optional brass nosing edge.
// Auto-rotate-with-5s-pause is handled by ModelShell when interactiveAutoRotate=true.

import StepFlight from '../primitives/StepFlight'
import TexturedFloor from '../primitives/TexturedFloor'

const TREAD_DEPTH = 0.28
const RISER_HEIGHT = 0.18
const STEP_WIDTH = 1.2
const FLIGHT_STEPS = 10
const LANDING_SIZE = 1.4
const LANDING_Y = FLIGHT_STEPS * RISER_HEIGHT  // 1.8m

export default function ModelC({
  zoneTextures = {},
  activeZone,
  onZoneClick,
  showNosing = true,
}) {
  return (
    <group>
      {/* Flight 1 — 10 steps ascending +X */}
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

      {/* Landing platform — L-shaped turn between flights */}
      <TexturedFloor
        size={[LANDING_SIZE, LANDING_SIZE + STEP_WIDTH]}
        position={[
          FLIGHT_STEPS * TREAD_DEPTH + LANDING_SIZE / 2,
          LANDING_Y,
          -LANDING_SIZE / 2 + STEP_WIDTH / 2,
        ]}
        source={zoneTextures.landing}
        repeat={2}
        isActive={activeZone === 'landing'}
        onClick={() => onZoneClick?.('landing')}
      />

      {/* Flight 2 — 10 steps ascending along -Z (L-turn) */}
      <group
        position={[
          FLIGHT_STEPS * TREAD_DEPTH + LANDING_SIZE / 2,
          LANDING_Y,
          STEP_WIDTH / 2 - LANDING_SIZE,
        ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
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
      </group>

      {/* Concrete stringer under Flight 1 */}
      <mesh
        position={[
          (FLIGHT_STEPS * TREAD_DEPTH) / 2,
          LANDING_Y / 2 - 0.12,
          0,
        ]}
        rotation={[0, 0, Math.atan2(LANDING_Y, FLIGHT_STEPS * TREAD_DEPTH)]}
        receiveShadow
      >
        <boxGeometry args={[
          Math.sqrt((FLIGHT_STEPS * TREAD_DEPTH) ** 2 + LANDING_Y ** 2),
          0.16,
          STEP_WIDTH,
        ]} />
        <meshStandardMaterial color="#353330" roughness={0.85} metalness={0} />
      </mesh>

      {/* Landing slab */}
      <mesh
        position={[
          FLIGHT_STEPS * TREAD_DEPTH + LANDING_SIZE / 2,
          LANDING_Y - 0.12,
          -LANDING_SIZE / 2 + STEP_WIDTH / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[LANDING_SIZE, 0.2, LANDING_SIZE + STEP_WIDTH]} />
        <meshStandardMaterial color="#353330" roughness={0.85} metalness={0} />
      </mesh>

      {/* Handrail — Flight 1 left side */}
      <mesh
        position={[
          (FLIGHT_STEPS * TREAD_DEPTH) / 2,
          LANDING_Y / 2 + 0.9,
          STEP_WIDTH / 2 + 0.04,
        ]}
        rotation={[0, 0, Math.atan2(LANDING_Y, FLIGHT_STEPS * TREAD_DEPTH)]}
      >
        <cylinderGeometry args={[0.025, 0.025, Math.sqrt((FLIGHT_STEPS * TREAD_DEPTH) ** 2 + LANDING_Y ** 2) * 1.05, 16]} />
        <meshStandardMaterial color="#361d0d" roughness={0.35} />
      </mesh>

      {/* Handrail — Flight 1 right side */}
      <mesh
        position={[
          (FLIGHT_STEPS * TREAD_DEPTH) / 2,
          LANDING_Y / 2 + 0.9,
          -STEP_WIDTH / 2 - 0.04,
        ]}
        rotation={[0, 0, Math.atan2(LANDING_Y, FLIGHT_STEPS * TREAD_DEPTH)]}
      >
        <cylinderGeometry args={[0.025, 0.025, Math.sqrt((FLIGHT_STEPS * TREAD_DEPTH) ** 2 + LANDING_Y ** 2) * 1.05, 16]} />
        <meshStandardMaterial color="#361d0d" roughness={0.35} />
      </mesh>

      {/* Side wall — inner */}
      <mesh
        position={[
          (FLIGHT_STEPS * TREAD_DEPTH) / 2,
          LANDING_Y,
          -STEP_WIDTH / 2 - 0.08,
        ]}
        receiveShadow
      >
        <boxGeometry args={[
          FLIGHT_STEPS * TREAD_DEPTH + 0.3,
          LANDING_Y * 2 + 0.5,
          0.15,
        ]} />
        <meshStandardMaterial color="#353330" roughness={0.85} metalness={0} />
      </mesh>
    </group>
  )
}
