import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SSR, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Desktop-only post-processing.
//
// Three passes, each doing something the forward renderer structurally cannot:
//
//   N8AO  — ambient occlusion computed from the depth buffer every frame.
//           The Blender-baked aoMap only darkens where a mesh occludes ITSELF;
//           it knows nothing about a bath sitting against a wall, or a tile
//           band meeting the floor. Contact darkening at those junctions is
//           most of what stops a render reading as flat.
//
//   SSR   — screen-space reflections, so the polished floor actually shows the
//           room standing on it. Constrained to smooth surfaces via
//           maxRoughness, which is both physically right (a matt tile should
//           not mirror) and the single biggest cost saving, since rough
//           pixels are skipped outright.
//
//   Bloom — a restrained specular bleed. Kept subtle on purpose: the
//           threshold sits high so it only touches genuine highlights rather
//           than washing the whole frame.
//
// Tone mapping moves off the renderer and into the composer's final pass. It
// has to: with ACES applied at material-shading time, every effect above would
// be operating on already-compressed, display-referred colour, so a bloom
// threshold or a reflection would be reading the wrong values. Doing it last
// keeps the chain in linear HDR right up to the point of display, and the
// on-screen result matches what the renderer produced before.
// ---------------------------------------------------------------------------

export default function PostFX({ enabled = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!enabled) return undefined
    const previous = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    // Tone mapping is a shader-program parameter, so every material has to be
    // recompiled when it changes. Without this the scene renders with the old
    // program and the change appears to do nothing until something else
    // happens to invalidate the material.
    const invalidate = () => scene.traverse((o) => { if (o.material) o.material.needsUpdate = true })
    invalidate()
    return () => {
      gl.toneMapping = previous
      invalidate()
    }
  }, [enabled, gl, scene])

  if (!enabled) return null

  return (
    <EffectComposer
      // MSAA on the composer's own render target. The Canvas's `antialias`
      // flag only covers the default framebuffer, which post-processing never
      // draws the scene into, so without this the edges come back jagged.
      multisampling={4}
      disableNormalPass={false}
    >
      <N8AO
        // Metres. The bathroom is 2.5m across, so a ~0.35m radius catches
        // wall/floor junctions and the gap under fixtures without smearing
        // a grey haze across open wall.
        aoRadius={0.35}
        distanceFalloff={0.8}
        intensity={2.2}
        quality="medium"
        halfRes
      />
      <SSR
        intensity={0.35}
        // Only mirror-ish surfaces reflect. Above this roughness the effect
        // skips the pixel entirely — correct for matt tile, and where most of
        // the performance comes back.
        maxRoughness={0.25}
        // Deliberately short rays and few steps: reflections here only need to
        // travel a metre or two of floor, and cost scales with both.
        MAX_STEPS={12}
        NUM_BINARY_SEARCH_STEPS={5}
        rayStep={0.4}
        thickness={2.5}
        maxDepthDifference={3}
        temporalResolve
        temporalResolveMix={0.9}
        ENABLE_BLUR
        blurKernelSize={1}
        blurMix={0.35}
        ior={1.45}
        USE_ROUGHNESSMAP
        USE_NORMALMAP
      />
      <Bloom intensity={0.12} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
