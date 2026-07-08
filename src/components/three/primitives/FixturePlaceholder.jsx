// Simple primitive fixtures — not the focus, just placeholders.
// Per PRD §4.2/§4.3/§4.6 — "simple grey cylinder/box primitive".

export function ShowerFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Shower head — vertical disc */}
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
        <meshStandardMaterial color="#9a9488" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Pipe */}
      <mesh position={[0, 6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="#7a6f5c" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

export function WCFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 1.2]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.95, -0.3]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.3]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    </group>
  )
}

export function Faucet({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  )
}

export function Basin({ position = [0, 0, 0], style = 'rect' }) {
  if (style === 'round') {
    return (
      <mesh position={position} castShadow>
        <cylinderGeometry args={[0.5, 0.4, 0.3, 24]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    )
  }
  if (style === 'vessel') {
    return (
      <mesh position={position} castShadow>
        <sphereGeometry args={[0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    )
  }
  // rectangular undermount (default)
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[1.2, 0.3, 0.7]} />
      <meshStandardMaterial color="#eceae4" roughness={0.3} />
    </mesh>
  )
}
