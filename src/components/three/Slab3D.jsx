import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { getMaterialTexture } from '../../utils/threeTextures'
import { swatches } from '../../data/products'

// A polished marble/granite slab that turns slowly on its own and speeds up on
// hover — a tactile showcase of surface texture for the About section.

function Slab() {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const swatch = useMemo(
    () => swatches.find((s) => s.id === 'marble-statuario') || swatches[0],
    [],
  )
  const texture = useMemo(() => getMaterialTexture(swatch, 1), [swatch])

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * (hovered ? 0.9 : 0.25)
    }
  })

  return (
    <mesh
      ref={ref}
      rotation={[0.35, 0.4, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
    >
      <boxGeometry args={[3, 4, 0.25]} />
      <meshStandardMaterial map={texture} roughness={0.18} metalness={0.25} />
    </mesh>
  )
}

export default function Slab3D({ frameloop = 'always' }) {
  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 6.5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Self-contained lighting — no remote HDR environment map needed. */}
      <hemisphereLight args={['#f6f1e7', '#2a2622', 0.8]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 5, 6]} intensity={2} color="#f3e6cf" />
      <directionalLight position={[-5, -2, 2]} intensity={0.6} color="#b08d4f" />
      <Slab />
    </Canvas>
  )
}
