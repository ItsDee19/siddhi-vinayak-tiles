import * as THREE from 'three'
import { useMemo } from 'react'

// BackdropGradient — a large back-facing sphere that wraps the scene.
// Vertex colors fade from warm-light at the top to deep brown at the
// bottom. Replaces the flat <color attach="background" /> so the model
// has atmospheric context.
//
// Place inside the <Canvas> in ModelShell. Visible from any angle.

const VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const FRAG = /* glsl */`
  varying vec3 vWorldPos;
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  void main() {
    float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
  }
`

export default function BackdropGradient({
  topColor = '#5C3A22',
  bottomColor = '#1A0E05',
  exponent = 0.6,
  radius = 60,
}) {
  const uniforms = useMemo(
    () => ({
      topColor:    { value: new THREE.Color(topColor) },
      bottomColor: { value: new THREE.Color(bottomColor) },
      offset:      { value: 0 },
      exponent:    { value: exponent },
    }),
    [topColor, bottomColor, exponent],
  )
  return (
    <mesh scale={[radius, radius, radius]} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
