import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'

// Keep pre-rendered content visible before JavaScript and while hydrating.
// Animate a small positional reveal only after this block enters the viewport.
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  once = true,
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduce ? undefined : { y: [Math.min(y, 12), 0] }}
      viewport={{ once, amount: 0.25 }}
      transition={
        reduce
          ? { duration: 0, delay: 0 }
          : { duration: MOTION_DURATION.reveal, delay: Math.min(delay, 0.24), ease: MOTION_EASE }
      }
    >
      {children}
    </motion.div>
  )
}
