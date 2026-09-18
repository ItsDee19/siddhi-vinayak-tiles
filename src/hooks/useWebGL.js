import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Detects whether the device can comfortably run the 3D canvases. Returns
// `true` only when WebGL is available AND the device isn't an obviously
// low-power / reduced-motion environment — so we can fall back to static art.
export function useWebGL() {
  const [supported, setSupported] = useState(null) // null = still checking
  const reduce = useReducedMotion()

  useEffect(() => {
    const connection = navigator.connection
    const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2
    const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2
    if (reduce || lowCores || lowMem || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) {
      setSupported(false)
      return
    }
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')

      if (!gl) {
        setSupported(false)
        return
      }

      gl.getExtension('WEBGL_lose_context')?.loseContext()
      setSupported(true)
    } catch {
      setSupported(false)
    }
  }, [reduce])

  return supported
}
