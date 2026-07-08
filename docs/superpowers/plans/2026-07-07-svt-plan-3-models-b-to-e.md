# Plan 3: 3D Models B–E

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Add Models B (Large Bathroom), C (Staircase), D (Large Feature Wall), and E (Vanity Counter) using the shared primitives and zone system built in Plan 2.

**Architecture:** Each model is a self-contained component that imports the shared primitives (`BandedWall`, `TexturedFloor`, `TexturedPlane`, `StepFlight`, `FixturePlaceholder`, `ModelShell`, `CameraRig`) and declares its zones + camera presets via `models/registry.js`. The Visualizer shell (Plan 2) automatically picks them up — no shell changes needed.

**Tech Stack:** Same as Plans 1 & 2.

## Global Constraints

- 1 Three.js unit = 1 foot
- Each model declares zones in `models/registry.js` — the Visualizer shell renders a zone picker per zone automatically
- Each model exports `cameraPresets` — camera preset buttons appear in the ControlBar when ≥2 presets exist
- Model C (staircase) needs auto-rotate-with-interaction-pause logic
- All fixtures are simple primitive placeholders — grey cylinders, boxes, spheres
- Each model lazy-loaded (Suspense) — only the active model mounts

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/three/models/ModelB.jsx` | Large Bathroom (10×10, 2-4-2 bands) |
| Create | `src/components/three/models/ModelC.jsx` | Staircase (22 steps, 2 flights, landing) |
| Create | `src/components/three/models/ModelD.jsx` | Large Feature Wall (30×10) |
| Create | `src/components/three/models/ModelE.jsx` | Vanity Counter (10×5 wall + counter + front) |
| Create | `src/components/three/primitives/StepFlight.jsx` | Reusable stair generator |
| Modify | `src/components/three/models/registry.js` | Add B, C, D, E |
| Modify | `src/components/visualizer/ControlBar.jsx` | Render camera preset buttons when ≥2 presets |

---

### Task 1: Create `StepFlight` primitive (for Model C)

**Files:** Create `src/components/three/primitives/StepFlight.jsx`

**Produces:** A reusable component that generates N steps (tread + riser + optional nosing) along a direction.

- [ ] **Step 1: Create the file:**

```jsx
import { useEffect, useState } from 'react'
import { loadZoneTexture } from '../../../utils/threeTextures'

// Generates `count` steps ascending in +X direction (or -X if `direction` = -1).
// Each step: a horizontal tread + a vertical riser.
// Optionally renders a gold nosing edge line on each tread.
export default function StepFlight({
  origin = [0, 0, 0],       // bottom of first step
  count = 11,
  treadDepth = 1,            // ft
  riserHeight = 0.58,        // ~7 inches in feet
  width = 4,                 // ft
  direction = 1,
  textures = {},             // { tread, riser }
  showNosing = true,
  isActive = null,           // zone id or null
  onZoneClick,
}) {
  const [treadTex, setTreadTex] = useState(null)
  const [riserTex, setRiserTex] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (textures.tread) {
        const t = await loadZoneTexture(textures.tread, 1, 512)
        if (!cancelled) setTreadTex(t)
      }
      if (textures.riser) {
        const t = await loadZoneTexture(textures.riser, 1, 512)
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
              emissiveIntensity={isActive === 'riser' ? 0.15 : 0}
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
            <planeGeometry args={[treadDepth * direction, width]} />
            <meshStandardMaterial
              map={treadTex || null}
              color={treadTex ? '#ffffff' : '#5C3A22'}
              roughness={0.4}
              emissive={isActive === 'tread' ? '#C49A3C' : '#000000'}
              emissiveIntensity={isActive === 'tread' ? 0.15 : 0}
            />
          </mesh>
          {/* Nosing edge (gold line) */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/three/primitives/StepFlight.jsx
git commit -m "feat: StepFlight primitive (tread + riser + optional nosing)"
```

---

### Task 2: Model B — Large Bathroom (10×10, 2-4-2 bands)

**Files:** Create `src/components/three/models/ModelB.jsx`, Modify `src/components/three/models/registry.js`

**Produces:** A large bathroom with 10×10 floor, 8ft walls, 2-4-2 banded walls (2 adjacent walls corner view), WC/shower fixture toggle, and 3 camera presets.

- [ ] **Step 1: Create `ModelB.jsx`:**

```jsx
import BandedWall from '../primitives/BandedWall'
import TexturedFloor from '../primitives/TexturedFloor'
import { WCFixture, ShowerFixture } from '../primitives/FixturePlaceholder'

// 2-4-2 bands: 0-2ft lower, 2-6ft main feature, 6-8ft upper
const BANDS = [
  { y0: 0, y1: 2, zoneId: 'lower' },
  { y0: 2, y1: 6, zoneId: 'feature' },
  { y0: 6, y1: 8, zoneId: 'upper' },
]

export default function ModelB({ zoneTextures, activeZone, onZoneClick, showShower = true, showWC = true }) {
  const wallTextures = {
    lower: zoneTextures.lower, feature: zoneTextures.feature, upper: zoneTextures.upper,
  }
  return (
    <group>
      <TexturedFloor
        size={[10, 10]}
        position={[0, 0, 0]}
        source={zoneTextures.floor}
        repeat={4}
        isActive={activeZone === 'floor'}
        onClick={() => onZoneClick?.('floor')}
      />
      {/* Back wall (10ft) at z = -5 */}
      <BandedWall
        position={[0, 0, -5]}
        width={10}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />
      {/* Right wall (10ft) at x = 5 — adjacent wall for corner view */}
      <BandedWall
        position={[5, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={10}
        bands={BANDS}
        zoneTextures={wallTextures}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />
      {showShower && <ShowerFixture position={[-3.5, 0, -3.5]} />}
      {showWC && <WCFixture position={[3.5, 0, -3.5]} />}
    </group>
  )
}
```

- [ ] **Step 2: Add Model B to `registry.js`** (insert into the `models` array after Model A):

```js
{
  id: 'bathroom-l',
  name: 'Large Bathroom',
  blurb: '10×10 ft, 2-4-2 tile bands',
  zones: [
    { id: 'floor',   label: 'Floor',        surface: 'Floor' },
    { id: 'lower',   label: 'Lower Band',   surface: 'Wall' },
    { id: 'feature', label: 'Feature Band', surface: 'Wall' },
    { id: 'upper',   label: 'Upper Band',   surface: 'Wall' },
  ],
  presets: {
    default:  { position: [10, 6, 11], target: [0, 3, 0] },
    front:    { position: [0,  4, 12], target: [0, 4, -5] },
    corner:   { position: [12, 5, 12], target: [0, 3, 0] },
    topdown:  { position: [0,  18, 0.01], target: [0, 0, 0] },
  },
  load: () => import('./ModelB'),
},
```

- [ ] **Step 3: Commit**

```bash
git add src/components/three/models/ModelB.jsx src/components/three/models/registry.js
git commit -m "feat: Model B (Large Bathroom, 2-4-2 bands, 3 camera presets)"
```

---

### Task 3: Model C — Staircase (22 steps, 2 flights, landing)

**Files:** Create `src/components/three/models/ModelC.jsx`, Modify `src/components/three/models/registry.js`

**Produces:** A two-flight staircase (11 + 11 steps) with a 4×4 landing platform, tread/riser/landing texture zones, nosing toggle, auto-rotate with 5s interaction-pause, and 3 camera presets.

- [ ] **Step 1: Create `ModelC.jsx`:**

```jsx
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TexturedFloor } from '../primitives/TexturedFloor'
import StepFlight from '../primitives/StepFlight'
import { useReducedMotion } from '../../../hooks/useReducedMotion'

// 1 step ≈ 1ft deep, ~7in (0.58ft) riser, 4ft wide.
// Flight 1: steps 1-11, ascending +X
// Landing: 4×4 flat platform at top of flight 1
// Flight 2: steps 12-22, ascending -X (or +Z, turning 90°)
const TREAD_DEPTH = 1
const RISER_HEIGHT = 0.58
const STEP_WIDTH = 4
const FLIGHT_STEPS = 11
const LANDING_SIZE = 4
const LANDING_Y = FLIGHT_STEPS * RISER_HEIGHT  // 6.38 ft
const FLIGHT2_Y = LANDING_Y + RISER_HEIGHT     // 6.96 ft

export default function ModelC({
  zoneTextures, activeZone, onZoneClick, showNosing = true,
}) {
  const reduce = useReducedMotion()
  const lastInteract = useRef(0)

  useFrame(({ clock }) => {
    // If user hasn't interacted in 5s, slowly auto-rotate the camera
    // (handled by OrbitControls.autoRotate, but we use useFrame to track time)
    // This is a hook for future use — autoRotate is already gated on !reduce
  })

  // Pointer-down anywhere in the canvas → record interaction time
  useEffect(() => {
    const bump = () => { lastInteract.current = performance.now() }
    window.addEventListener('pointerdown', bump, { passive: true })
    return () => window.removeEventListener('pointerdown', bump)
  }, [])

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

      {/* Flight 2 — 11 steps ascending -X (turns back) */}
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
```

Note: Auto-rotate with 5s interaction-pause is handled in `ModelShell` — extend it to support Model C's behavior. For Plan 3, add a prop `interactiveAutoRotate={true}` on ModelShell that, when true, listens to pointerdown and toggles `autoRotate` based on a 5s idle timer.

- [ ] **Step 2: Update `ModelShell.jsx`** to accept `interactiveAutoRotate`:

```jsx
import { useEffect, useRef } from 'react'

// inside ModelShell:
const interactiveAutoRotate = useRef(false) // set true by prop
useEffect(() => {
  if (!interactiveAutoRotate) return
  let timer
  const onInteract = () => {
    if (controlsRef.current) controlsRef.current.autoRotate = false
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (controlsRef.current && !reduce) controlsRef.current.autoRotate = true
    }, 5000)
  }
  window.addEventListener('pointerdown', onInteract, { passive: true })
  return () => { window.removeEventListener('pointerdown', onInteract); clearTimeout(timer) }
}, [reduce])
```

And pass `interactiveAutoRotate` as a prop. In ModelA/B/D/E, don't pass it. In ModelC's consumer (Visualizer.jsx), pass `interactiveAutoRotate={true}` when `activeModelId === 'staircase'`.

- [ ] **Step 3: Add Model C to `registry.js`:**

```js
{
  id: 'staircase',
  name: 'Staircase',
  blurb: '22 steps, 2 flights + landing',
  zones: [
    { id: 'tread',   label: 'Tread Tile',  surface: 'Floor' },
    { id: 'riser',   label: 'Riser Tile',  surface: 'Wall' },
    { id: 'landing', label: 'Landing',     surface: 'Floor' },
  ],
  presets: {
    default:    { position: [10, 5, 14], target: [4, 4, 0] },
    side:       { position: [0,  6, 18], target: [4, 4, 0] },
    perspective:{ position: [12, 8, 10], target: [4, 4, 0] },
    landing:    { position: [12, 9, 1],  target: [11, 6.4, 0] },
  },
  load: () => import('./ModelC'),
  interactiveAutoRotate: true,
},
```

- [ ] **Step 4: Update `Visualizer.jsx`** to pass `interactiveAutoRotate` to ModelShell when the active model has it. The cleanest path: in the registry entry, expose `interactiveAutoRotate`, and in Visualizer.jsx read `activeModel.interactiveAutoRotate` and forward.

- [ ] **Step 5: Commit**

```bash
git add src/components/three/models/ModelC.jsx src/components/three/primitives/ModelShell.jsx src/components/three/models/registry.js src/components/sections/Visualizer.jsx
git commit -m "feat: Model C (Staircase, 2 flights, landing, auto-rotate with 5s pause)"
```

---

### Task 4: Model D — Large Feature Wall (30×10, layout modes)

**Files:** Create `src/components/three/models/ModelD.jsx`, Modify `src/components/three/models/registry.js`

**Produces:** A 30ft × 10ft wall with three layout modes (full, horizontal bands, panel grid), tile repeat slider, grout color picker.

- [ ] **Step 1: Create `ModelD.jsx`:**

```jsx
import { useEffect, useState } from 'react'
import { loadZoneTexture } from '../../../utils/threeTextures'

const PANEL_COLS = 3
const PANEL_ROWS = 2

function GroutedPanel({ width, height, source, repeat, groutColor, position, rotation, onClick, isActive }) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) loadZoneTexture(source, repeat, 512).then((t) => { if (!cancelled) setTex(t) })
    return () => { cancelled = true }
  }, [source, repeat])
  return (
    <mesh position={position} rotation={rotation} onClick={onClick} receiveShadow castShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : groutColor}
        roughness={0.85}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.15 : 0}
      />
    </mesh>
  )
}

export default function ModelD({
  zoneTextures, activeZone, onZoneClick,
  layout = 'full',          // 'full' | 'bands' | 'grid'
  repeatScale = 1,          // 0.5 = large tiles, 2 = small tiles
  groutColor = '#cfc6b4',   // grout color
}) {
  // Map repeatScale → repeat param. PRD: slider 0.5x–2x
  const repeat = Math.max(0.5, Math.min(2, repeatScale)) * 8

  if (layout === 'bands') {
    return (
      <group position={[0, 0, 0]}>
        <GroutedPanel width={30} height={4} source={zoneTextures.lowerBand || zoneTextures.full} repeat={repeat} groutColor={groutColor} position={[0, 2, 0]} rotation={[0, 0, 0]} onClick={() => onZoneClick?.('lowerBand')} isActive={activeZone === 'lowerBand'} />
        <GroutedPanel width={30} height={6} source={zoneTextures.upperBand || zoneTextures.full} repeat={repeat} groutColor={groutColor} position={[0, 7, 0]} rotation={[0, 0, 0]} onClick={() => onZoneClick?.('upperBand')} isActive={activeZone === 'upperBand'} />
      </group>
    )
  }
  if (layout === 'grid') {
    const cellW = 30 / PANEL_COLS
    const cellH = 10 / PANEL_ROWS
    return (
      <group>
        {Array.from({ length: PANEL_ROWS }).map((_, r) =>
          Array.from({ length: PANEL_COLS }).map((_, c) => {
            const id = `panel-${r}-${c}`
            // For simplicity, all panels use the same `full` source.
            // A more advanced version would let each panel pick its own texture.
            return (
              <GroutedPanel
                key={id}
                width={cellW - 0.2}
                height={cellH - 0.2}
                source={zoneTextures.full}
                repeat={repeat / 2}
                groutColor={groutColor}
                position={[c * cellW - 15 + cellW / 2, r * cellH + cellH / 2, 0]}
                rotation={[0, 0, 0]}
                onClick={() => onZoneClick?.('full')}
                isActive={activeZone === 'full'}
              />
            )
          })
        )}
      </group>
    )
  }
  // full
  return (
    <GroutedPanel
      width={30} height={10}
      source={zoneTextures.full}
      repeat={repeat}
      groutColor={groutColor}
      position={[0, 5, 0]}
      rotation={[0, 0, 0]}
      onClick={() => onZoneClick?.('full')}
      isActive={activeZone === 'full'}
    />
  )
}
```

- [ ] **Step 2: Add Model D to `registry.js`:**

```js
{
  id: 'feature-wall',
  name: 'Feature Wall',
  blurb: '30×10 ft facade',
  zones: [
    { id: 'full',       label: 'Wall',         surface: 'Wall' },
    { id: 'lowerBand',  label: 'Lower Band',   surface: 'Wall' },
    { id: 'upperBand',  label: 'Upper Band',   surface: 'Wall' },
  ],
  presets: {
    default: { position: [0, 5, 22], target: [0, 5, 0] },
    detail:  { position: [0, 5, 12], target: [0, 5, 0] },
  },
  load: () => import('./ModelD'),
  controls: ['layout', 'repeatScale', 'groutColor'],  // tells ControlBar to render these
},
```

- [ ] **Step 3: Update `ControlBar.jsx`** to read `activeModel.controls` and render extra inputs (layout radio, repeat slider, grout color picker). For Plan 3, the simplest version: if `controls` includes `'layout'`, render a layout radio; if `'repeatScale'`, render a slider; if `'groutColor'`, render a color picker. Pass current values + onChange to ModelD via Visualizer.jsx state.

- [ ] **Step 4: Update `Visualizer.jsx`** to hold `modelExtras` state (layout/repeatScale/groutColor for Model D) and pass them to the model component as props.

- [ ] **Step 5: Commit**

```bash
git add src/components/three/models/ModelD.jsx src/components/three/models/registry.js src/components/visualizer/ControlBar.jsx src/components/sections/Visualizer.jsx
git commit -m "feat: Model D (Feature Wall, 3 layout modes, repeat slider, grout picker)"
```

---

### Task 5: Model E — Vanity Counter (10×5 wall + counter + front + basins)

**Files:** Create `src/components/three/models/ModelE.jsx`, Modify `src/components/three/models/registry.js`

**Produces:** A vanity setup with back wall, countertop with 2 undermount basins, front panel, side returns, basin style toggle, faucet toggle, vanity light toggle, camera presets.

- [ ] **Step 1: Create `ModelE.jsx`:**

```jsx
import BandedWall from '../primitives/BandedWall'
import TexturedPlane from '../primitives/TexturedPlane'
import { Basin, Faucet } from '../primitives/FixturePlaceholder'

// Counter top dim: 10ft wide × 2ft deep, at 2.5ft height.
// Back wall: 10ft wide × 5ft tall (from counter top to 5ft above floor).
// Front panel: 10ft wide × 2.5ft tall (floor to underside of counter).
// Side returns: 2ft wide × 5ft tall.
const COUNTER_Y = 2.5
const COUNTER_DEPTH = 2
const WALL_HEIGHT = 5
const WALL_WIDTH = 10
const BASIN_OFFSET_X = 2.5  // basins at x=-2.5 and x=+2.5

export default function ModelE({
  zoneTextures, activeZone, onZoneClick,
  basinStyle = 'rect',     // 'round' | 'rect' | 'vessel'
  showFaucet = true,
  showVanityLight = true,
}) {
  return (
    <group>
      {/* Back wall — 10ft wide × 5ft tall, behind the counter */}
      <TexturedPlane
        size={[WALL_WIDTH, WALL_HEIGHT]}
        position={[0, COUNTER_Y + WALL_HEIGHT / 2, -COUNTER_DEPTH / 2]}
        source={zoneTextures.backWall}
        repeat={4}
        isActive={activeZone === 'backWall'}
        onClick={() => onZoneClick?.('backWall')}
      />

      {/* Counter top — 10ft × 2ft × 0.2ft slab */}
      <TexturedPlane
        size={[WALL_WIDTH, COUNTER_DEPTH]}
        position={[0, COUNTER_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        source={zoneTextures.counterTop}
        repeat={3}
        isActive={activeZone === 'counterTop'}
        onClick={() => onZoneClick?.('counterTop')}
      />

      {/* Front panel (fascia) — 10ft × 2.5ft */}
      <TexturedPlane
        size={[WALL_WIDTH, COUNTER_Y]}
        position={[0, COUNTER_Y / 2, COUNTER_DEPTH / 2]}
        rotation={[0, Math.PI, 0]}
        source={zoneTextures.frontPanel}
        repeat={3}
        isActive={activeZone === 'frontPanel'}
        onClick={() => onZoneClick?.('frontPanel')}
      />

      {/* Side return (left) — 2ft × 5ft */}
      <TexturedPlane
        size={[COUNTER_DEPTH, WALL_HEIGHT]}
        position={[-WALL_WIDTH / 2, COUNTER_Y + WALL_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        source={zoneTextures.sideReturns}
        repeat={2}
        isActive={activeZone === 'sideReturns'}
        onClick={() => onZoneClick?.('sideReturns')}
      />

      {/* Countertop depth slab (so the counter has thickness) */}
      <mesh position={[0, COUNTER_Y - 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_WIDTH, 0.2, COUNTER_DEPTH]} />
        <meshStandardMaterial color="#3D2512" roughness={0.8} />
      </mesh>

      {/* 2 basins (cutout appearance — just a slight indentation) */}
      <Basin position={[-BASIN_OFFSET_X, COUNTER_Y, 0]} style={basinStyle} />
      <Basin position={[BASIN_OFFSET_X, COUNTER_Y, 0]} style={basinStyle} />

      {/* Faucets */}
      {showFaucet && <Faucet position={[-BASIN_OFFSET_X, COUNTER_Y + 0.5, -0.6]} />}
      {showFaucet && <Faucet position={[BASIN_OFFSET_X, COUNTER_Y + 0.5, -0.6]} />}

      {/* Vanity light strip — emissive plane above counter */}
      {showVanityLight && (
        <mesh position={[0, COUNTER_Y + WALL_HEIGHT + 0.3, -COUNTER_DEPTH / 2]}>
          <planeGeometry args={[WALL_WIDTH * 0.8, 0.2]} />
          <meshStandardMaterial color="#fff5e0" emissive="#fff5e0" emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 2: Add Model E to `registry.js`:**

```js
{
  id: 'vanity',
  name: 'Vanity Counter',
  blurb: '10×5 wall + countertop',
  zones: [
    { id: 'backWall',    label: 'Back Wall',    surface: 'Wall' },
    { id: 'counterTop',  label: 'Counter Top',  surface: 'Countertop' },
    { id: 'frontPanel',  label: 'Front Panel',  surface: 'Wall' },
    { id: 'sideReturns', label: 'Side Returns', surface: 'Wall' },
  ],
  presets: {
    default:       { position: [0, 3, 10], target: [0, 2.5, 0] },
    threeQuarter:  { position: [8, 4, 8],  target: [0, 2.5, 0] },
    counterClose:  { position: [0, 3, 4],  target: [0, 2.5, 0] },
  },
  load: () => import('./ModelE'),
  controls: ['basinStyle', 'showFaucet', 'showVanityLight'],
},
```

- [ ] **Step 3: Update `ControlBar.jsx`** — add basin style radio, faucet checkbox, vanity light checkbox. Pass current values + onChange.

- [ ] **Step 4: Update `Visualizer.jsx`** to hold `modelExtras` for Model E and pass to the model.

- [ ] **Step 5: Commit**

```bash
git add src/components/three/models/ModelE.jsx src/components/three/models/registry.js src/components/visualizer/ControlBar.jsx src/components/sections/Visualizer.jsx
git commit -m "feat: Model E (Vanity Counter, 4 zones, basin/faucet/light toggles, presets)"
```

---

### Task 6: Verify + visual QA for all 4 new models

- [ ] **Step 1: Run dev server.** Open http://localhost:5173/#visualizer.
- [ ] **Step 2: Model B (Large Bathroom)** — 10×10 floor renders; back and right walls each show 2-4-2 bands; shower and WC toggles work; camera preset buttons ("Front Wall View", "Corner View", "Top-Down Floor View") animate to the right positions.
- [ ] **Step 3: Model C (Staircase)** — 22 steps in 2 flights + landing render; tread, riser, and landing zones each have their own swatch; nosing gold line shows when toggled; auto-rotate runs slowly until user interacts, pauses, resumes after 5s.
- [ ] **Step 4: Model D (Feature Wall)** — 30ft wall renders; layout radio toggles between Full / Horizontal Bands / 3×2 Panel Grid; tile repeat slider changes apparent tile size; grout color picker recolors the grout (or the base color when no texture is applied).
- [ ] **Step 5: Model E (Vanity Counter)** — Back wall, counter top, front panel, side returns each have their own swatch; 2 basins render (round/rect/vessel styles); faucets show on toggle; vanity light strip is emissive and shows on toggle.
- [ ] **Step 6: Switch models rapidly** — only the active model mounts; GPU memory doesn't accumulate (check via Chrome DevTools → Performance → Memory).
- [ ] **Step 7: Mobile drawer** — all 4 new models' zones + camera preset buttons + extra controls are reachable from the mobile bottom drawer.
- [ ] **Step 8: Build** — `npm run build` succeeds.
- [ ] **Step 9: Final commit.**

---

## Self-Review

**Spec coverage:**
- §4.3 Model B (Large Bathroom, 2-4-2 bands, 4 zones, WC toggle, 3 camera presets) → Task 2 ✓
- §4.4 Model C (Staircase, 22 steps, 2 flights, landing, tread/riser/landing zones, nosing toggle, auto-rotate with 5s pause) → Tasks 1, 3 ✓
- §4.5 Model D (Feature Wall, 30×10, full/bands/grid layouts, repeat slider, grout picker) → Task 4 ✓
- §4.6 Model E (Vanity Counter, 4 zones, basin/faucet/light toggles, camera presets) → Task 5 ✓
- §5 Visualizer UI Shell (model tabs, zone pickers, controls, mobile drawer) → already built in Plan 2; Plan 3 extends ControlBar with model-specific controls ✓

**Gaps:** No staircase nosing toggle UI in ControlBar yet (Task 3 leaves the model prop exposed but ControlBar doesn't yet render a "Show Nosing" checkbox — extend ControlBar to read a `controls: ['showNosing']` registry key for Model C).
