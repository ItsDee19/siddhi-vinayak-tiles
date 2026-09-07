import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

// Environment reflections stay stable through glass and material changes.
// Contact shading and antialiasing clarify the geometry without temporal SSR.
export default function PostFX() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const previous = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    const update = () => scene.traverse((o) => {
      const materials = Array.isArray(o.material) ? o.material : [o.material]
      materials.forEach((m) => { if (m) m.needsUpdate = true })
    })
    update()
    return () => { gl.toneMapping = previous; update() }
  }, [gl, scene])

  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.16} distanceFalloff={1} intensity={1.25} quality="medium" halfRes />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
