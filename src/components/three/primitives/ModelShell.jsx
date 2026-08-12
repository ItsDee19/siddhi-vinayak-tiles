import { Suspense, lazy, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { setMaxAnisotropy } from '../../../utils/threeTextures'
import CameraRig, { OrbitControls } from './CameraRig'
import BackdropGradient from './BackdropGradient'

// Lazily imported so the postprocessing library — ~280KB, the single largest
// dependency the visualizer pulls in — is only ever downloaded by the tier
// that actually runs it. Statically imported it landed in the Visualizer
// chunk for everyone, including the phones where PostFX is switched off.
const PostFX = lazy(() => import('./PostFX'))

// The original procedural rig: four Lightformer planes baked into a cube map
// once. Retained as the phone-tier environment and as the desktop Suspense
// fallback while the HDR loads. Zero bytes, zero network.
function ProceduralEnvironment({ resolution }) {
  return (
    <Environment resolution={resolution} frames={1} background={false}>
      <Lightformer form="rect" intensity={2.6} color="#fff5e0" position={[4, 6, 4]} scale={[8, 8, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={0.9} color="#dfe6f0" position={[-5, 4, -3]} scale={[6, 6, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#ffecd2" position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 14, 1]} />
      <Lightformer form="ring" intensity={0.7} color="#7A4A28" position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[16, 16, 1]} />
    </Environment>
  )
}

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
  cinematicMode = false,
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
        shadows={lite ? { type: THREE.PCFSoftShadowMap } : 'soft'}
        frameloop={frameloop}
        dpr={lite ? [1, 1.5] : [1, 2]}
        camera={{ position: initialPos, fov: 40, near: 0.1, far: 120 }}
        gl={{
          antialias: !lite,
          powerPreference: lite ? 'low-power' : 'high-performance',
          preserveDrawingBuffer: true, // enables canvas.toDataURL() for screenshots
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={({ gl, scene, camera }) => {
          setMaxAnisotropy(gl.capabilities.getMaxAnisotropy())
          if (import.meta.env.DEV) window.__three = { gl, scene, camera }
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

        {/* ── Image-based lighting ────────────────────────────────────────
            Desktop loads a real HDR environment (public/hdri/showroom.hdr,
            authored by scripts/build_environment_hdr.mjs): a mullioned window
            bank, ceiling softboxes and warm floor bounce, at a 207:1 dynamic
            range. Glossy tile sells its realism through what it reflects, and
            a window with structure reads as a room where a plain bright
            rectangle reads as nothing.

            Phones keep the procedural Lightformer rig — it costs no download
            and no HDR decode, which matters far more there than reflection
            detail does. The same rig is the Suspense fallback on desktop, so
            the scene is correctly lit from the first frame and simply gets
            better when the 778KB HDR arrives, rather than flashing black. */}
        {lite ? (
          <ProceduralEnvironment resolution={128} />
        ) : (
          <Suspense fallback={<ProceduralEnvironment resolution={256} />}>
            <Environment files="/hdri/showroom.hdr" resolution={256} background={false} />
          </Suspense>
        )}

        {/* ── Analytic lighting — kept minimal now that IBL supplies the
            ambient wrap. The old flat ambient/hemisphere fill (1.35 combined)
            was a major reason everything looked flat; it's now mostly
            replaced by the environment above rather than stacked on top. */}
        <hemisphereLight skyColor="#fff5e0" groundColor="#3d2210" intensity={0.15} />

        {/* Key light: warm, upper-right — provides main illumination + cast shadows */}
        <directionalLight
          position={[6, 10, 5]}
          intensity={1.4}
          castShadow
          color="#fff5e0"
          shadow-mapSize={lite ? [1024, 1024] : [2048, 2048]}
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
        <directionalLight position={[-5, 6, -4]} intensity={0.25} color="#e8dcd0" />

        {/* Rim light: behind & above — edge highlights for depth */}
        <directionalLight position={[0, 8, -8]} intensity={0.35} color="#ffecd2" />

        {children}

        {/* Soft contact shadows under the model — a cheap AO approximation.
            `frames={1}` bakes it once at mount instead of every frame, so
            it's now affordable on mobile too rather than skipped outright.
            Eased off on desktop, where N8AO in PostFX now supplies real
            per-frame contact darkening and the two would otherwise stack into
            an over-dark pool under the model. */}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={lite ? 0.5 : 0.3}
          scale={20}
          blur={2.8}
          far={6}
          resolution={lite ? 512 : 1024}
          frames={1}
          color="#1A0E05"
        />

        {/* Screen-space AO, reflections and specular bloom. Desktop only —
            see PostFX for why each pass earns its cost. Gated by rendering
            rather than by a prop, so the lazy chunk is never even requested
            on the phone tier. */}
        {!lite && (
          <Suspense fallback={null}>
            <PostFX />
          </Suspense>
        )}

        {showControls && (
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={3}
            maxDistance={20}
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={cinematicMode || !reduce}
            autoRotateSpeed={cinematicMode ? 2.0 : 0.4}
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
