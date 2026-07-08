import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import CameraRig, { OrbitControls } from './CameraRig'

// Wraps every model. Children render the actual geometry.
// cameraPresets is a { [name]: { position, target } } map; first preset is the default.
// presetName selects which preset to display.
// interactiveAutoRotate (Model C): pauses autoRotate on pointer, resumes after 5s.
export default function ModelShell({
  children,
  cameraPresets = {},
  presetName,
  frameloop = 'always',
  showControls = true,
  interactiveAutoRotate = false,
}) {
  const reduce = useReducedMotion()
  const controlsRef = useRef(null)
  const presetNames = Object.keys(cameraPresets)
  const initial = cameraPresets[presetName] || cameraPresets[presetNames[0]] || cameraPresets.default
  const initialPos = initial?.position || [6, 5, 7]
  const initialTarget = initial?.target || [0, 0, 0]

  // Interactive auto-rotate (Model C) — pointer/wheel pauses, 5s idle resumes
  useAutoRotateOnIdle(controlsRef, interactiveAutoRotate, reduce)

  return (
    <>
      <Canvas
        shadows
        frameloop={frameloop}
        dpr={[1, 1.8]}
        camera={{ position: initialPos, fov: 40 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true, // enables canvas.toDataURL() for screenshots
        }}
      >
        <color attach="background" args={['#3D2512']} />
        <hemisphereLight args={['#f3e6cf', '#2a2622', 0.9]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.7}
          castShadow
          color="#f3e6cf"
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.4} color="#C49A3C" />

        {children}

        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={6} />
        {showControls && (
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={3}
            maxDistance={20}
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={!reduce}
            autoRotateSpeed={0.4}
            target={initialTarget}
          />
        )}
      </Canvas>
      <CameraRig presets={cameraPresets} active={presetName || presetNames[0]} controlsRef={controlsRef} />
    </>
  )
}

// Hook: when interactiveAutoRotate is true, pause OrbitControls.autoRotate
// on any pointer event and resume after 5s of no interaction.
function useAutoRotateOnIdle(controlsRef, enabled, reduce) {
  useEffect(() => {
    if (!enabled) return
    let timer
    const onInteract = () => {
      if (controlsRef.current) controlsRef.current.autoRotate = false
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (controlsRef.current && !reduce) controlsRef.current.autoRotate = true
      }, 5000)
    }
    window.addEventListener('pointerdown', onInteract, { passive: true })
    window.addEventListener('wheel', onInteract, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('wheel', onInteract)
      clearTimeout(timer)
    }
  }, [enabled, controlsRef, reduce])
}
