import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import { getMaterialTexture } from '../../utils/threeTextures'

// A small interior scene whose FLOOR re-textures live when the user picks a
// swatch. Drag to orbit, scroll to zoom (clamped). This is the visualizer's
// "preview how a tile looks in a room" centrepiece.

function Floor({ swatch }) {
  const texture = useMemo(() => getMaterialTexture(swatch, 4), [swatch])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial map={texture} roughness={0.4} metalness={0.15} />
    </mesh>
  )
}

function Room() {
  const wall = '#e7dcc9'
  const wallDark = '#d8c7ad'
  return (
    <group>
      {/* back wall */}
      <mesh position={[0, 3, -5]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {/* left wall */}
      <mesh position={[-5, 3, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color={wallDark} roughness={0.95} />
      </mesh>
      {/* skirting */}
      <mesh position={[0, 0.15, -4.95]}>
        <boxGeometry args={[10, 0.3, 0.1]} />
        <meshStandardMaterial color="#f6f1e7" roughness={0.6} />
      </mesh>

      {/* simple furniture for scale */}
      {/* sofa */}
      <group position={[-1.6, 0, 1.6]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[2.6, 0.5, 1]} />
          <meshStandardMaterial color="#3a3633" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.95, -0.45]} castShadow>
          <boxGeometry args={[2.6, 0.9, 0.25]} />
          <meshStandardMaterial color="#4a4541" roughness={0.8} />
        </mesh>
      </group>
      {/* coffee table */}
      <mesh position={[0.9, 0.35, 1.4]} castShadow>
        <boxGeometry args={[1.4, 0.12, 0.8]} />
        <meshStandardMaterial color="#b08d4f" roughness={0.35} metalness={0.3} />
      </mesh>
      {/* potted plant block */}
      <mesh position={[3.4, 0.6, -3]} castShadow>
        <cylinderGeometry args={[0.4, 0.3, 1.2, 12]} />
        <meshStandardMaterial color="#33473b" roughness={0.7} />
      </mesh>
      {/* window light panel on back wall */}
      <mesh position={[2.6, 3.4, -4.92]}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshStandardMaterial color="#f6f1e7" emissive="#f3e6cf" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

export default function Room3D({ swatch }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [6.5, 5, 7], fov: 40 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#23211f']} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.6}
        castShadow
        color="#f3e6cf"
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.4} color="#b08d4f" />
      <Room />
      <Floor swatch={swatch} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={12} blur={2.4} far={6} />
      <Environment preset="apartment" />
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={13}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate
        autoRotateSpeed={0.4}
        target={[0, 0.6, 0]}
      />
    </Canvas>
  )
}
