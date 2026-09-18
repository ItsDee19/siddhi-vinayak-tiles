import { useEffect, useRef, useState } from 'react'

// Returns [ref, entered, visible].
//   entered — latches true once the element first comes near the viewport
//             (use this to MOUNT heavy 3D canvases lazily, then keep them).
//   visible — live in/out-of-view state (use this to PAUSE a canvas's render
//             loop when it scrolls off-screen, saving GPU/CPU/battery).
//
// A backstop applies only if the observer never reports. A known off-screen
// canvas must stay paused instead of being reactivated by the fallback timer.
export function useInView({
  rootMargin = '200px',
  fallbackMs = 2500,
  initial = false,
} = {}) {
  const ref = useRef(null)
  const [entered, setEntered] = useState(initial)
  const [visible, setVisible] = useState(initial)

  useEffect(() => {
    const el = ref.current
    let timer

    if (el && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          clearTimeout(timer)
          const v = entries.some((e) => e.isIntersecting)
          setVisible(v)
          if (v) setEntered(true)
        },
        { rootMargin },
      )
      io.observe(el)
      // Backstop for renderers that never deliver IO callbacks.
      timer = setTimeout(() => {
        setEntered(true)
        setVisible(true)
      }, fallbackMs)
      return () => {
        io.disconnect()
        clearTimeout(timer)
      }
    }

    // No IntersectionObserver support: just activate.
    setEntered(true)
    setVisible(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [ref, entered, visible]
}
