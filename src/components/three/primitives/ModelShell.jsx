import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import CameraRig, { OrbitControls } from './CameraRig'
import BackdropGradient from './BackdropGradient'

// Wraps every model. Children render the actual geometry.
// cameraPresets is a { [name]: { position, target } } map; first preset is the default.
// presetName selects which preset to display.
// interactiveAutoRotate (Model C): pauses autoRotate on pointer, resumes after 5s.
// quality: 'full' | 'lite' (see useDeviceTier) — 'lite' shrinks shadow/contact-shadow
// resolution for phones/tablets. All lighting is local (zero network fetches).
export default function ModelShell({
  children,
  cameraPresets = {},
  presetName,
  frameloop = 'always',
  showControls = true,
  interactiveAutoRotate = false,
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

        {/* ── Studio Lighting (fully local — zero network fetches) ────────
            Replaces the remote HDRI Environment that fetched lebombo_1k.hdr
            from a CDN (which fails on Netlify / content-blocked browsers).
            The multi-light setup below replicates the warm showroom IBL look. */}

        {/* Hemisphere: sky/ground ambient fill — simulates soft IBL wrap */}
        <hemisphereLight skyColor="#fff5e0" groundColor="#3d2210" intensity={0.85} />

        {/* Ambient: baseline fill so no surface is fully black */}
        <ambientLight intensity={0.5} />

        {/* Key light: warm, upper-right — provides main illumination + cast shadows */}
        <directionalLight
          position={[6, 10, 5]}
          intensity={1.8}
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

        {/* Fill light: cooler, opposite side — softens harsh shadows */}
        <directionalLight position={[-5, 6, -4]} intensity={0.7} color="#e8dcd0" />

        {/* Rim light: behind & above — edge highlights for depth */}
        <directionalLight position={[0, 8, -8]} intensity={0.5} color="#ffecd2" />

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
