import { useEffect, useRef, useState } from 'react'

// Returns [ref, entered, visible].
//   entered — latches true once the element first comes near the viewport
//             (use this to MOUNT heavy 3D canvases lazily, then keep them).
//   visible — live in/out-of-view state (use this to PAUSE a canvas's render
//             loop when it scrolls off-screen, saving GPU/CPU/battery).
//
// A `fallbackMs` backstop activates both flags even where IntersectionObserver
// callbacks don't fire (some headless / offscreen renderers), so nothing stays
// stuck on a placeholder.
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
  }, [rootMargin, fallbackMs])

  return [ref, entered, visible]
}
