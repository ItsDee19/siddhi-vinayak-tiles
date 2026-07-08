import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// presets: { [name]: { position: [x,y,z], target: [x,y,z] } }
// Animates the camera + OrbitControls target to the active preset over ~600ms.
export default function CameraRig({ presets, active, controlsRef }) {
  const { camera } = useThree()
  const animating = useRef(false)

  useEffect(() => {
    const p = presets[active] || (presets.default && presets[Object.keys(presets)[0]])
    if (!p) return
    animating.current = true
    const startPos = camera.position.clone()
    const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3()
    const endPos = new THREE.Vector3(...p.position)
    const endTarget = new THREE.Vector3(...p.target)
    const start = performance.now()
    const dur = 600

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      camera.position.lerpVectors(startPos, endPos, eased)
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, endTarget, eased)
        controlsRef.current.update()
      }
      if (t < 1) requestAnimationFrame(tick)
      else animating.current = false
    }
    requestAnimationFrame(tick)
  }, [active, presets, camera, controlsRef])

  return null
}

export { OrbitControls }
