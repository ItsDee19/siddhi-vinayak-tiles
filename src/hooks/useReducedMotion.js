import { useEffect, useState } from 'react'

// PRD §2.5 / NF5: respects prefers-reduced-motion across all animated
// components. Returns true when the user has requested reduced motion.
// SSR-safe and listener-updating (responds to OS setting changes live).
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
