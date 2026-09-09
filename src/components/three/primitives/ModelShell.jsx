import { Component, Suspense, lazy, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, useEnvironment } from '@react-three/drei'
import * as THREE from 'three'
import { setMaxAnisotropy } from '../../../utils/threeTextures'
import InteriorCamera from './InteriorCamera'
import { createNeutralEnvironmentMap, getRoomLighting, ROOM_COLOR_PIPELINE, ROOM_LIGHT_COLORS } from './roomLighting'

const PostFX = lazy(() => import('./PostFX'))

// Broad neutral sources remain usable while the HDR loads, or if it fails.
function ProceduralEnvironment({ resolution, intensity }) {
  return (
    <Environment resolution={resolution} frames={1} background={false} environmentIntensity={intensity}>
      <color attach="background" args={[ROOM_LIGHT_COLORS.environment]} />
      <Lightformer form="rect" intensity={3} color={ROOM_LIGHT_COLORS.source} position={[-4, 5, 5]} scale={[5, 7, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.5} color={ROOM_LIGHT_COLORS.source} position={[5, 3, 2]} scale={[3, 5, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.8} color={ROOM_LIGHT_COLORS.source} position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
    </Environment>
  )
}

class EnvironmentFallback extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function NeutralEnvironment({ intensity }) {
  const source = useEnvironment({ files: '/hdri/showroom.hdr' })
  const resource = useMemo(() => ({ texture: createNeutralEnvironmentMap(source), active: false }), [source])
  useEffect(() => {
    resource.active = true
    return () => {
      resource.active = false
      queueMicrotask(() => {
        if (!resource.active) resource.texture.dispose()
      })
    }
  }, [resource])
  return <Environment map={resource.texture} background={false} environmentIntensity={intensity} />
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
        toneMapping: ROOM_COLOR_PIPELINE.toneMapping,
        toneMappingExposure: ROOM_COLOR_PIPELINE.exposure,
        outputColorSpace: ROOM_COLOR_PIPELINE.outputColorSpace,
      }}
      onCreated={({ gl, scene, camera }) => {
        setMaxAnisotropy(gl.capabilities.getMaxAnisotropy())
        if (import.meta.env.DEV) window.__three = { gl, scene, camera }
      }}
    >
      <color attach="background" args={[ROOM_LIGHT_COLORS.background]} />
      <EnvironmentFallback fallback={<ProceduralEnvironment resolution={lite ? 128 : 256} intensity={0.6} />}>
        <Suspense fallback={<ProceduralEnvironment resolution={lite ? 128 : 256} intensity={0.6} />}>
          <NeutralEnvironment intensity={light.environmentIntensity} />
        </Suspense>
      </EnvironmentFallback>
      <hemisphereLight args={[ROOM_LIGHT_COLORS.source, ROOM_LIGHT_COLORS.bounce, 0.24]} />
      <primitive object={lightTarget} />
      <directionalLight
        key={roomId}
        target={lightTarget}
        position={light.key}
        intensity={light.keyIntensity}
        color={ROOM_LIGHT_COLORS.source}
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
      <directionalLight position={light.fill} intensity={light.fillIntensity} color={ROOM_LIGHT_COLORS.source} />
      <directionalLight position={[0, 6, -4]} intensity={0.16} color={ROOM_LIGHT_COLORS.source} />

      {children}
      {!lite && <Suspense fallback={null}><PostFX /></Suspense>}
      <InteriorCamera presets={cameraPresets} presetName={presetName || firstName} resetKey={cameraResetKey} />
    </Canvas>
  )
}
