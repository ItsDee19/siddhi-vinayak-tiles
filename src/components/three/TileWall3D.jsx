import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getMaterialTexture } from '../../utils/threeTextures'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { swatches } from '../../data/products'

// A floating grid/wall of tile planes that drifts gently, tilts with the
// pointer (parallax), and spreads apart as the user scrolls down the hero.

const COLS = 5
const ROWS = 4
const GAP = 1.18

// Pick a spread of materials for visual variety in the wall.
const WALL_SWATCHES = [
  'marble-statuario',
  'granite-black',
  'wood-walnut',
  'marble-beige',
  'quartz-snow',
  'granite-rose',
  'terrazzo-sand',
  'marble-emerald',
  'quartz-champagne',
  'ceramic-slate',
  'granite-pearl',
  'marble-noir',
  'quartz-onyx',
  'granite-steel',
  'ceramic-ivory',
  'quartz-mist',
  'marble-statuario',
  'granite-black',
  'wood-walnut',
  'marble-beige',
]

function Tile({ position, swatch, index }) {
  const ref = useRef()
  // Hero tiles are small on screen — a 256px texture is plenty and ~4x cheaper.
  const texture = useMemo(() => getMaterialTexture(swatch, 1, 256), [swatch])
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const reduce = useReducedMotion()

  useFrame((state) => {
    if (reduce || !ref.current) return
    const t = state.clock.elapsedTime
    // gentle bobbing drift
    ref.current.position.z = position[2] + Math.sin(t * 0.6 + phase) * 0.18
    ref.current.rotation.x = Math.sin(t * 0.4 + phase) * 0.04
    ref.current.rotation.y = Math.cos(t * 0.3 + phase) * 0.05
  })

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1, 1, 0.08]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0.12} />
    </mesh>
  )
}

function Wall({ scrollRef }) {
  const group = useRef()
  const reduce = useReducedMotion()

  const tiles = useMemo(() => {
    const arr = []
    let i = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = WALL_SWATCHES[i % WALL_SWATCHES.length]
        const swatch = swatches.find((s) => s.id === id) || swatches[0]
        arr.push({
          key: `${r}-${c}`,
          swatch,
          base: [
            (c - (COLS - 1) / 2) * GAP,
            ((ROWS - 1) / 2 - r) * GAP,
            0,
          ],
          index: i,
        })
        i++
      }
    }
    return arr
  }, [])

  useFrame((state) => {
    if (reduce || !group.current) return
    const p = state.pointer // normalized -1..1
    // parallax tilt toward pointer
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      p.x * 0.35,
      0.05,
    )
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -p.y * 0.25,
      0.05,
    )
    // scroll spreads tiles apart + pushes back
    const s = scrollRef.current
    group.current.scale.setScalar(1 + s * 0.45)
    group.current.position.z = -s * 6
    group.current.children.forEach((child, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1
      child.position.y = child.userData.baseY + s * dir * 1.5
    })
  })

  return (
    <group ref={group} rotation={[0.05, 0, 0]}>
      {tiles.map((t) => (
        <group
          key={t.key}
          position={t.base}
          ref={(o) => o && (o.userData.baseY = t.base[1])}
        >
          <Tile position={[0, 0, 0]} swatch={t.swatch} index={t.index} />
        </group>
      ))}
    </group>
  )
}

export default function TileWall3D({ scrollRef, frameloop = 'always' }) {
  // scrollRef is a ref holding 0..1 hero scroll progress, updated by the parent.
  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 9], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#2C1A0E']} />
      <fog attach="fog" args={['#2C1A0E', 9, 20]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 8]} intensity={1.5} color="#f3e6cf" />
      <directionalLight position={[-6, -2, 4]} intensity={0.5} color="#b08d4f" />
      <Wall scrollRef={scrollRef} />
    </Canvas>
  )
}
