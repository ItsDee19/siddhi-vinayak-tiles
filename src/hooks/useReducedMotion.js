import { useSyncExternalStore } from 'react'

// PRD §2.5 / NF5: respects prefers-reduced-motion across all animated
// components. Returns true when the user has requested reduced motion.
// SSR-safe and listener-updating (responds to OS setting changes live).
const query = '(prefers-reduced-motion: reduce)'
const getServerSnapshot = () => false
const getSnapshot = () => Boolean(window.matchMedia?.(query).matches)
const subscribe = (onChange) => {
  const media = window.matchMedia?.(query)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
