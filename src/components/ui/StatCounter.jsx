import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { usePageVisible } from '../../hooks/usePageVisible'
import { MOTION_EASE } from '../../utils/motion'

// Counts up from 0 to `value` once it scrolls into view.
// Respects prefers-reduced-motion (NF5) — shows final value immediately.
export default function StatCounter({ value, suffix = '', duration = 1000 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { amount: 0.5 })
  const reduce = useReducedMotion()
  const pageVisible = usePageVisible()
  const started = useRef(false)
  const count = useMotionValue(reduce ? value : 0)
  const display = useTransform(count, (n) => Math.round(n).toLocaleString('en-IN'))

  useEffect(() => {
    if (reduce || started.current) {
      count.jump(value)
      return
    }
    if (!inView || !pageVisible) return
    started.current = true
    const controls = animate(count, value, { duration: duration / 1000, ease: MOTION_EASE })
    return () => controls.stop()
  }, [inView, pageVisible, value, duration, reduce, count])

  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{value.toLocaleString('en-IN')}{suffix}</span>
      <span aria-hidden="true"><motion.span>{display}</motion.span>{suffix}</span>
    </span>
  )
}
