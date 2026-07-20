import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Chooses a rendering profile for the 3D canvases:
//   'full' — desktop-class: remote HDRI (IBL), full-res shadows, contact shadows.
//   'lite' — phones/tablets and reduced-motion: skip the HDRI network fetch,
//            shrink the shadow map, and drop ContactShadows.
//
// Applies to ALL narrow viewports, not just "weak" devices — mobile data and
// thermal budgets are tighter across the board (even flagship phones), and
// navigator.deviceMemory isn't available on iOS at all, so viewport width is
// the more reliable signal here. Re-evaluated on resize/orientation change.
export function useDeviceTier() {
  const reduce = useReducedMotion()
  const [tier, setTier] = useState(() => computeTier(reduce))

  useEffect(() => {
    const onResize = () => setTier(computeTier(reduce))
    onResize()
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [reduce])

  return tier
}

function computeTier(reduce) {
  if (reduce) return 'lite'
  if (typeof window === 'undefined') return 'full'
  const narrow = window.matchMedia?.('(max-width: 820px)').matches
  const lowCores =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= 4
  return narrow || lowCores ? 'lite' : 'full'
}
