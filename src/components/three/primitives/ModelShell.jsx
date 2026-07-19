import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import CameraRig, { OrbitControls } from './CameraRig'
import BackdropGradient from './BackdropGradient'

// Wraps every model. Children render the actual geometry.
// cameraPresets is a { [name]: { position, target } } map; first preset is the default.
// presetName selects which preset to display.
// interactiveAutoRotate (Model C): pauses autoRotate on pointer, resumes after 5s.
// quality: 'full' | 'lite' (see useDeviceTier) — 'lite' skips the remote HDRI
// fetch and shrinks shadow/contact-shadow resolution for phones/tablets.
export default function ModelShell({
  children,
  cameraPresets = {},
  presetName,
  frameloop = 'always',
  showControls = true,
  interactiveAutoRotate = false,
  envPreset = 'apartment',  // drei bundled HDRI preset — gives photo-real IBL
  quality = 'full',
}) {
  const reduce = useReducedMotion()
  const lite = quality === 'lite'
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
        shadows={lite ? false : 'soft'}
        frameloop={frameloop}
        dpr={lite ? [1, 1.5] : [1, 2]}
        camera={{ position: initialPos, fov: 40 }}
        gl={{
          antialias: !lite,
          powerPreference: lite ? 'low-power' : 'high-performance',
          preserveDrawingBuffer: true, // enables canvas.toDataURL() for screenshots
          toneMapping: 4, // THREE.ACESFilmicToneMapping
          toneMappingExposure: 1.3,
        }}
      >
        <color attach="background" args={['#4A3522']} />
        <fog attach="fog" args={['#4A3522', 24, 55]} />

        {/* Atmospheric backdrop — warm light at the top fading to deep
            brown at the floor. Visible at the edges of the camera frame. */}
        <BackdropGradient
          topColor="#7A4A28"
          bottomColor="#1A0E05"
          exponent={0.7}
          radius={50}
        />

        {/* IBL — Environment drives the primary lighting. 'apartment' gives
            a warm, lived-in showroom glow. Background={false} means we
            keep our own dark brown backdrop; only the lighting is used.
            Skipped on 'lite' — it's a remote HDRI fetch (extra mobile data)
            and the ambient/directional lights below carry the scene fine. */}
        {!lite && <Environment preset={envPreset} background={false} />}

        {/* Ambient — a bit stronger on 'lite' since there's no IBL fill. */}
        <ambientLight intensity={lite ? 0.55 : 0.34} />

        {/* Key directional — provides the sharp cast shadows. Shadow map is
            much smaller on 'lite' (or shadows are off entirely via Canvas
            shadows={false} above), which is the biggest mobile GPU cost. */}
        <directionalLight
          position={[6, 10, 5]}
          intensity={1.7}
          castShadow={!lite}
          color="#fff5e0"
          shadow-mapSize={lite ? [512, 512] : [2048, 2048]}
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

        {/* Soft contact shadows under the model — better AO approximation.
            Skipped on 'lite': it's an extra offscreen render pass per frame. */}
        {!lite && (
          <ContactShadows
            position={[0, 0.005, 0]}
            opacity={0.5}
            scale={20}
            blur={2.8}
            far={6}
            resolution={1024}
            color="#1A0E05"
          />
        )}

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
