import { useEffect, useRef } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MOTION_DURATION } from '../../utils/motion'

// 3D tilt-on-hover: tracks the cursor and applies a perspective transform with
// a soft glow that follows the pointer. Respects touch (no tilt on tap) and
// prefers-reduced-motion (no tilt or glow at all — NF5).
export default function TiltCard({ children, className = '', max = 8, onClick, as = 'div', ...props }) {
  const Component = as === 'button' ? motion.button : motion.div
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const bounds = useRef(null)
  const rotateX = useSpring(0, { stiffness: 260, damping: 30 })
  const rotateY = useSpring(0, { stiffness: 260, damping: 30 })
  const glowX = useMotionValue(50)
  const glowY = useMotionValue(50)
  const glowOpacity = useMotionValue(0)
  const background = useMotionTemplate`radial-gradient(380px circle at ${glowX}% ${glowY}%, rgba(196,154,60,0.18), transparent 45%)`

  useEffect(() => {
    if (!reduce) return
    rotateX.jump(0)
    rotateY.jump(0)
    glowOpacity.set(0)
  }, [reduce, rotateX, rotateY, glowOpacity])

  const handleMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    const rect = bounds.current || el.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    rotateX.set((0.5 - py) * max)
    rotateY.set((px - 0.5) * max)
    glowX.set(px * 100)
    glowY.set(py * 100)
    glowOpacity.set(1)
  }

  const reset = () => {
    bounds.current = null
    rotateX.set(0)
    rotateY.set(0)
    glowOpacity.set(0)
  }

  return (
    <Component
      {...props}
      ref={ref}
      onPointerEnter={() => { bounds.current = ref.current?.getBoundingClientRect() }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onClick={onClick}
      style={reduce ? {} : { rotateX, rotateY, transformPerspective: 900 }}
      className={`relative ${className}`}
    >
      {/* cursor-following glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity"
        style={{
          opacity: glowOpacity,
          background,
          transitionDuration: `${MOTION_DURATION.fast}s`,
        }}
      />
      {children}
    </Component>
  )
}
