import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Detects whether the device can comfortably run the 3D canvases. Returns
// `true` only when WebGL is available AND the device isn't an obviously
// low-power / reduced-motion environment — so we can fall back to static art.
export function useWebGL() {
  const [supported, setSupported] = useState(null) // null = still checking
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) {
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

      // Very weak devices: bail to keep things smooth. Either weak signal is
      // enough on its own — requiring both let most budget phones through.
      const lowCores =
        typeof navigator.hardwareConcurrency === 'number' &&
        navigator.hardwareConcurrency <= 2
      const lowMem =
        typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2

      setSupported(!(lowCores || lowMem))
    } catch {
      setSupported(false)
    }
  }, [reduce])

  return supported
}
