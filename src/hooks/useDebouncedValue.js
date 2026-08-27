import { useEffect, useState } from 'react'

// Holds a trailing copy of `value` that only updates after it has stopped
// changing for `delayMs`. Use this to decouple an expensive effect (recompute,
// refetch, recompose) from a fast-firing input like a drag or a slider, while
// the input's own displayed value stays instant.
export function useDebouncedValue(value, delayMs = 150) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}
