import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei/materials/MeshReflectorMaterial.js'
import { BlurPass } from '@react-three/drei/materials/BlurPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import * as THREE from 'three'

/** Attach a real room reflection to the factory's flat, forward-facing mirror.
 * The offscreen camera is Three's planar Reflector; the finish is Drei's
 * MeshReflectorMaterial. We own the render targets so changing rooms frees
 * them. Direct material attachment leaves the native mesh in its room's
 * hierarchy instead of registering it as an independent R3F portal root.
 */
export default function RoomMirror({ root, tier = 'full' }) {
  const { gl, camera, scene } = useThree()
  const mirror = useMemo(() => root?.getObjectByName('mirror_silver_face'), [root])
  const resolution = tier === 'lite' ? 512 : 1024
  const resources = useMemo(() => {
    if (!mirror) return null
    const reflector = new Reflector(mirror.geometry, {
      textureWidth: resolution,
      textureHeight: resolution,
      multisample: 0,
      clipBias: 0.001,
    })
    const target = reflector.getRenderTarget()
    const blurred = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    })
    const blur = new BlurPass({ gl, resolution, width: resolution, height: resolution, depthScale: 0 })
    const finish = new MeshReflectorMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0 })
    finish.tDiffuse = target.texture
    finish.tDiffuseBlur = blurred.texture
    finish.textureMatrix = reflector.material.uniforms.textureMatrix.value
    finish.mirror = 1
    finish.mixStrength = 1
    finish.mixBlur = 0.35
    finish.mixContrast = 1
    finish.hasBlur = true
    finish.defines = { USE_BLUR: '' }
    // Reflected radiance has already been lit in the room. Feed that radiance
    // into the output directly, avoiding a second diffuse-light multiplication
    // which otherwise makes an indoor mirror dull grey or overexposed.
    const compileReflection = finish.onBeforeCompile.bind(finish)
    finish.onBeforeCompile = (shader, renderer) => {
      compileReflection(shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>',
      )
    }
    finish.customProgramCacheKey = () => 'room-planar-mirror-v1'
    return { reflector, target, blurred, blur, finish, active: false }
  }, [gl, mirror, resolution])

  useLayoutEffect(() => {
    if (!resources || !mirror) return undefined
    const previousMaterial = mirror.material
    mirror.material = resources.finish
    resources.active = true
    return () => {
      // Restore only our own attachment: another owner may have replaced the
      // material while the room was active. Never move or detach the mesh.
      if (mirror.material === resources.finish) mirror.material = previousMaterial
      resources.active = false
      queueMicrotask(() => {
        // StrictMode replays effects against the same resource instance.
        if (resources.active) return
        resources.reflector.dispose()
        resources.blurred.dispose()
        resources.blur.renderTargetA.dispose()
        resources.blur.renderTargetB.dispose()
        resources.blur.screen.geometry.dispose()
        resources.blur.convolutionMaterial.dispose()
        resources.finish.dispose()
      })
    }
  }, [mirror, resources])

  useFrame(() => {
    if (!resources?.active || !mirror?.visible) return
    // No onBeforeRender hook is attached to the real mirror, so the reflected
    // render cannot recursively trigger another reflection pass.
    const wasVisible = mirror.visible
    const previousTarget = gl.getRenderTarget()
    const previousXr = gl.xr.enabled
    const previousShadowUpdate = gl.shadowMap.autoUpdate
    const previousToneMapping = gl.toneMapping
    root.updateWorldMatrix(true, true)
    resources.reflector.matrixWorld.copy(mirror.matrixWorld)
    try {
      mirror.visible = false
      // Keep the capture linear; the normal scene pass applies tone mapping
      // once when it draws the mirror's reflected radiance to the display.
      gl.toneMapping = THREE.NoToneMapping
      resources.reflector.onBeforeRender(gl, scene, camera)
      resources.blur.render(gl, resources.target, resources.blurred)
    } finally {
      mirror.visible = wasVisible
      gl.xr.enabled = previousXr
      gl.shadowMap.autoUpdate = previousShadowUpdate
      gl.toneMapping = previousToneMapping
      gl.setRenderTarget(previousTarget)
    }
  })

  return null
}
