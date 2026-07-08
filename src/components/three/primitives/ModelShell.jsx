import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
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
  envPreset = 'apartment',  // drei bundled HDRI preset — gives photo-real IBL
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
        shadows="soft"
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: initialPos, fov: 40 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true, // enables canvas.toDataURL() for screenshots
          toneMapping: 4, // THREE.ACESFilmicToneMapping
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={['#3D2512']} />
        <fog attach="fog" args={['#3D2512', 22, 50]} />

        {/* IBL — Environment drives the primary lighting. 'apartment' gives
            a warm, lived-in showroom glow. Background={false} means we
            keep our own dark brown backdrop; only the lighting is used. */}
        <Environment preset={envPreset} background={false} />

        {/* Reduced ambient (Environment provides most of the ambient now).
            Keep just enough so dark zones aren't pitch black. */}
        <ambientLight intensity={0.18} />

        {/* Key directional — provides the sharp cast shadows. With IBL
            providing soft fill, the directional doesn't need to be as
            intense as before. */}
        <directionalLight
          position={[6, 10, 5]}
          intensity={1.4}
          castShadow
          color="#fff5e0"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-2}
          shadow-camera-near={1}
          shadow-camera-far={30}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />

        {children}

        {/* Soft contact shadows under the model — better AO approximation */}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.5}
          scale={20}
          blur={2.8}
          far={6}
          resolution={1024}
          color="#1A0E05"
        />

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

        <CameraRig
          presets={cameraPresets}
          active={presetName || presetNames[0]}
          controlsRef={controlsRef}
        />
      </Canvas>
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
