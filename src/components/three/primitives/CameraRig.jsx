import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { clampCameraOrbit, getCameraPreset } from './cameraSettings'

// Presets and resets use the same front-facing arc as pointer controls. Spherical
// interpolation avoids cutting through the room when crossing from left to right.
export default function CameraRig({ presets, active, controlsRef, resetKey = 0 }) {
  const { camera, invalidate } = useThree()
  const reduce = useReducedMotion()
  const transition = useRef(null)
  const previousPresets = useRef(null)
  const offset = useRef(new THREE.Vector3())
  const orbit = useRef(new THREE.Spherical())

  useEffect(() => {
    const preset = getCameraPreset(presets, active)
    const controls = controlsRef.current
    if (!preset) return

    const target = new THREE.Vector3(...preset.target)
    const endOrbit = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(...preset.position).sub(target),
    )
    if (controls) clampCameraOrbit(endOrbit, controls)

    const stop = () => {
      if (transition.current && controls) {
        controls.enableDamping = transition.current.enableDamping
      }
      transition.current = null
    }

    // Clear residual drag momentum before starting a preset, otherwise controls
    // can pull the camera away from its destination on the last animation frame.
    stop()
    const enableDamping = controls?.enableDamping ?? false
    if (controls) {
      controls.enableDamping = false
      controls.update()
    }

    if (reduce || previousPresets.current !== presets) {
      camera.position.copy(offset.current.setFromSpherical(endOrbit).add(target))
      if (controls) {
        controls.target.copy(target)
        controls.update()
        controls.enableDamping = enableDamping
      } else {
        camera.lookAt(target)
      }
    } else {
      const startTarget = controls?.target.clone() || target.clone()
      const startOrbit = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(startTarget),
      )
      if (controls) clampCameraOrbit(startOrbit, controls)
      transition.current = { startTarget, target, startOrbit, endOrbit, elapsed: 0, enableDamping }
    }
    previousPresets.current = presets
    invalidate()

    // An intentional drag takes over immediately. Effect cleanup also cancels a
    // prior reset/preset when another is chosen or the visualizer unmounts.
    controls?.addEventListener('start', stop)
    return () => {
      controls?.removeEventListener('start', stop)
      stop()
    }
  }, [active, presets, camera, controlsRef, resetKey, reduce, invalidate])

  useFrame((_, delta) => {
    const current = transition.current
    if (!current) return
    const controls = controlsRef.current
    current.elapsed += Math.min(delta, 0.05)
    const progress = Math.min(1, current.elapsed / 0.45)
    const eased = 1 - (1 - progress) ** 3
    orbit.current.set(
      THREE.MathUtils.lerp(current.startOrbit.radius, current.endOrbit.radius, eased),
      THREE.MathUtils.lerp(current.startOrbit.phi, current.endOrbit.phi, eased),
      THREE.MathUtils.lerp(current.startOrbit.theta, current.endOrbit.theta, eased),
    )
    const target = controls?.target || new THREE.Vector3()
    target.lerpVectors(current.startTarget, current.target, eased)
    camera.position.copy(offset.current.setFromSpherical(orbit.current).add(target))
    if (controls) controls.update()
    else camera.lookAt(target)
    if (progress === 1) {
      if (controls) controls.enableDamping = current.enableDamping
      transition.current = null
    } else {
      invalidate()
    }
  })

  return null
}

export { OrbitControls }
