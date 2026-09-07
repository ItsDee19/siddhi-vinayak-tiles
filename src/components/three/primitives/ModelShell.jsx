import { Suspense, lazy, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { setMaxAnisotropy } from '../../../utils/threeTextures'
import InteriorCamera from './InteriorCamera'
import { getRoomLighting } from './roomLighting'

const PostFX = lazy(() => import('./PostFX'))

// Broad neutral light sources retain the same material colours on mobile.
function ProceduralEnvironment({ resolution, intensity }) {
  return (
    <Environment resolution={resolution} frames={1} background={false} environmentIntensity={intensity}>
      <color attach="background" args={['#a6a29b']} />
      <Lightformer form="rect" intensity={3} color="#fffaf2" position={[-4, 5, 5]} scale={[5, 7, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.5} color="#edf3ff" position={[5, 3, 2]} scale={[3, 5, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
    </Environment>
  )
}

// A stationary architectural scene, viewed through a bounded front-facing arc.
export default function ModelShell({
  children,
  roomId,
  cameraPresets = {},

  cameraResetKey = 0,
  presetName,
  frameloop = 'always',

  quality = 'full',
}) {
  const lite = quality === 'lite'
  const light = getRoomLighting(roomId)
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D()
    target.position.set(...light.target)
    return target
  }, [roomId])

  const firstName = Object.keys(cameraPresets)[0]
  const initial = cameraPresets.default || cameraPresets[firstName]


  return (
    <Canvas
      shadows="soft"
      frameloop={frameloop}
      dpr={lite ? [1, 1.5] : [1, 2]}
      camera={{ position: initial?.position || [4, 3, 6], fov: 58, near: 0.04, far: 40 }}
      gl={{
        antialias: true,
        powerPreference: lite ? 'low-power' : 'high-performance',
        preserveDrawingBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
      onCreated={({ gl, scene, camera }) => {
        setMaxAnisotropy(gl.capabilities.getMaxAnisotropy())
        if (import.meta.env.DEV) window.__three = { gl, scene, camera }
      }}
    >
      <color attach="background" args={['#d8d3ca']} />
      {lite ? (
        <ProceduralEnvironment resolution={128} intensity={0.6} />
      ) : (
        <Suspense fallback={<ProceduralEnvironment resolution={256} intensity={0.6} />}>
          <Environment files="/hdri/showroom.hdr" background={false} environmentIntensity={light.environmentIntensity} />
        </Suspense>
      )}
      <hemisphereLight args={['#ffffff', '#b8aa91', 0.24]} />
      <primitive object={lightTarget} />
      <directionalLight
        key={roomId}
        target={lightTarget}
        position={light.key}
        intensity={light.keyIntensity}
        color="#fff9f0"
        castShadow
        shadow-mapSize={lite ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-light.extent}
        shadow-camera-right={light.extent}
        shadow-camera-top={light.extent}
        shadow-camera-bottom={-light.extent}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-bias={-0.00015}
        shadow-normalBias={0.002}
        shadow-radius={4}
      />
      <directionalLight position={[5, 4, 3]} intensity={light.fillIntensity} color="#edf3ff" />
      <directionalLight position={[0, 6, -4]} intensity={0.16} color="#ffffff" />

      {children}
      {!lite && <Suspense fallback={null}><PostFX /></Suspense>}
      <InteriorCamera presets={cameraPresets} presetName={presetName || firstName} resetKey={cameraResetKey} />
    </Canvas>
  )
}
