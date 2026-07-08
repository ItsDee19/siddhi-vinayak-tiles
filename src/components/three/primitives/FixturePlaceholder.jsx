// Simple primitive fixtures — not the focus, just placeholders.
// Per PRD §4.2/§4.3/§4.6 — "simple grey cylinder/box primitive".

export function ShowerFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Shower base / tray (sits on the floor) */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.1, 3]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Vertical riser pipe */}
      <mesh position={[0, 3.5, -1.3]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 7, 12]} />
        <meshStandardMaterial color="#9a9488" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Shower head (horizontal disc at top, pointing into the shower) */}
      <mesh position={[0, 6.8, -1.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.12, 24]} />
        <meshStandardMaterial color="#b5b0a8" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* Horizontal arm connecting riser to shower head */}
      <mesh position={[0, 6.8, -1.2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
        <meshStandardMaterial color="#7a6f5c" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  )
}

export function WCFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Bowl base */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1.4]} />
        <meshStandardMaterial color="#f0ede5" roughness={0.25} metalness={0.05} />
      </mesh>
      {/* Seat lid */}
      <mesh position={[0, 1.05, 0.1]} castShadow>
        <boxGeometry args={[1, 0.1, 1.4]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
      {/* Tank behind */}
      <mesh position={[0, 1.3, -0.5]} castShadow>
        <boxGeometry args={[0.9, 1.2, 0.35]} />
        <meshStandardMaterial color="#f0ede5" roughness={0.3} metalness={0.05} />
      </mesh>
    </group>
  )
}

export function Faucet({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.1, 12]} />
        <meshStandardMaterial color="#d4cfc5" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Spout */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 12]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.2} metalness={0.85} />
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
