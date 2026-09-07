import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import {
  clampInteriorLook,
  directionFromInteriorLook,
  getInteriorPreset,
  getInteriorView,
  zoomInteriorFov,
} from './interiorCameraSettings'

const DRAG_THRESHOLD = 5
const TRANSITION_SECONDS = 0.5

// Mount inside the room's Canvas. Presets may move the eye to another authored
// interior viewpoint; pointer, touch, wheel and keyboard never move its position.
export default function InteriorCamera({ presets = {}, presetName = 'default', resetKey = 0 }) {
  const { camera, gl, size, invalidate } = useThree()
  const reduceMotion = useReducedMotion()
  const aspect = size.width / size.height
  const mobile = aspect < 1
  const view = useRef(getInteriorView(getInteriorPreset(presets, presetName), { mobile, aspect }))
  const transition = useRef(null)
  const previousPresets = useRef(null)
  const lookTarget = useRef(new Vector3())
  const applyRef = useRef(null)

  applyRef.current = (next) => {
    view.current = next
    camera.position.fromArray(next.position)
    camera.up.set(0, 1, 0)
    lookTarget.current.fromArray(directionFromInteriorLook(next)).add(camera.position)
    camera.lookAt(lookTarget.current)
    if (camera.fov !== next.fov) {
      camera.fov = next.fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    invalidate()
  }

  useLayoutEffect(() => {
    const destination = getInteriorView(getInteriorPreset(presets, presetName), { mobile, aspect })
    transition.current = null
    if (reduceMotion || previousPresets.current !== presets) {
      applyRef.current(destination)
    } else {
      transition.current = {
        start: { ...view.current, position: [...view.current.position] },
        destination,
        elapsed: 0,
      }
      invalidate()
    }
    previousPresets.current = presets
    return () => { transition.current = null }
  }, [presets, presetName, resetKey, mobile, aspect, reduceMotion, invalidate])

  useEffect(() => {
    const canvas = gl.domElement
    const pointers = new Map()
    let pinchDistance = 0
    let moved = false
    let multiplePointers = false
    let suppressClickUntil = 0
    const originalTouchAction = canvas.style.touchAction
    const originalCursor = canvas.style.cursor
    const originalTabIndex = canvas.getAttribute('tabindex')
    const originalLabel = canvas.getAttribute('aria-label')
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    if (originalTabIndex === null) canvas.tabIndex = 0
    if (!originalLabel) {
      canvas.setAttribute('aria-label', 'Interactive room view. Drag or use arrow keys to look around. Scroll, pinch, or use plus and minus to zoom.')
    }

    const stopTransition = () => { transition.current = null }
    const applyLook = (changes) => {
      applyRef.current({ ...view.current, ...clampInteriorLook({ ...view.current, ...changes }) })
    }
    const distanceBetweenPointers = () => {
      const [a, b] = [...pointers.values()]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      stopTransition()
      if (pointers.size === 0) {
        moved = false
        multiplePointers = false
        suppressClickUntil = 0
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY })
      if (pointers.size > 1) {
        multiplePointers = true
        moved = true
        pinchDistance = distanceBetweenPointers()
      }
      canvas.setPointerCapture?.(event.pointerId)
      canvas.style.cursor = 'grabbing'
      if (event.pointerType === 'mouse') canvas.focus({ preventScroll: true })
    }
    const onPointerMove = (event) => {
      const pointer = pointers.get(event.pointerId)
      if (!pointer) return
      const dx = event.clientX - pointer.x
      const dy = event.clientY - pointer.y
      pointer.x = event.clientX
      pointer.y = event.clientY
      if (pointers.size > 1) {
        const distance = distanceBetweenPointers()
        if (pinchDistance > 0) applyLook({ fov: zoomInteriorFov(view.current.fov, pinchDistance, distance) })
        pinchDistance = distance
        event.preventDefault()
        return
      }
      // A finger left after a pinch cannot unexpectedly turn the room.
      if (multiplePointers) return
      if (!moved && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < DRAG_THRESHOLD) return
      moved = true
      const radiansPerPixel = (view.current.fov * Math.PI / 180) / Math.max(canvas.clientHeight, 1)
      applyLook({ yaw: view.current.yaw - dx * radiansPerPixel, pitch: view.current.pitch + dy * radiansPerPixel })
      event.preventDefault()
    }
    const onPointerEnd = (event) => {
      if (!pointers.has(event.pointerId)) return
      pointers.delete(event.pointerId)
      if (moved || multiplePointers) suppressClickUntil = performance.now() + 500
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      if (pointers.size === 0) {
        canvas.style.cursor = 'grab'
        pinchDistance = 0
      }
    }
    const onClick = (event) => {
      // R3F's click listener bubbles from the canvas. A capture listener stops
      // the click generated after a drag/pinch, while ordinary tile taps pass.
      if (performance.now() < suppressClickUntil) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    const onWheel = (event) => {
      stopTransition()
      event.preventDefault()
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1)
      applyLook({ fov: view.current.fov + pixels * 0.035 })
    }
    const onKeyDown = (event) => {
      const angle = (event.shiftKey ? 6 : 3) * Math.PI / 180
      const actions = {
        ArrowLeft: { yaw: view.current.yaw - angle },
        ArrowRight: { yaw: view.current.yaw + angle },
        ArrowUp: { pitch: view.current.pitch + angle },
        ArrowDown: { pitch: view.current.pitch - angle },
        '+': { fov: view.current.fov - 3 },
        '=': { fov: view.current.fov - 3 },
        '-': { fov: view.current.fov + 3 },
        _: { fov: view.current.fov + 3 },
      }
      if (!actions[event.key] || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      stopTransition()
      applyLook(actions[event.key])
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })
    canvas.addEventListener('pointerup', onPointerEnd)
    canvas.addEventListener('pointercancel', onPointerEnd)
    canvas.addEventListener('lostpointercapture', onPointerEnd)
    canvas.addEventListener('click', onClick, true)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('keydown', onKeyDown)
    return () => {
      transition.current = null
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerEnd)
      canvas.removeEventListener('pointercancel', onPointerEnd)
      canvas.removeEventListener('lostpointercapture', onPointerEnd)
      canvas.removeEventListener('click', onClick, true)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKeyDown)
      for (const pointerId of pointers.keys()) {
        if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId)
      }
      canvas.style.touchAction = originalTouchAction
      canvas.style.cursor = originalCursor
      if (originalTabIndex === null) canvas.removeAttribute('tabindex')
      else canvas.setAttribute('tabindex', originalTabIndex)
      if (originalLabel === null) canvas.removeAttribute('aria-label')
      else canvas.setAttribute('aria-label', originalLabel)
    }
  }, [gl])

  useFrame((_, delta) => {
    const active = transition.current
    if (!active) return
    active.elapsed += Math.min(delta, 0.05)
    const progress = Math.min(1, active.elapsed / TRANSITION_SECONDS)
    const eased = 1 - (1 - progress) ** 3
    const mix = (a, b) => a + (b - a) * eased
    applyRef.current({
      position: active.start.position.map((value, index) => mix(value, active.destination.position[index])),
      yaw: mix(active.start.yaw, active.destination.yaw),
      pitch: mix(active.start.pitch, active.destination.pitch),
      fov: mix(active.start.fov, active.destination.fov),
    })
    if (progress === 1) transition.current = null
  })

  return null
}
